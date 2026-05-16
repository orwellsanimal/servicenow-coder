#!/usr/bin/env node

/**
 * Build an importable ServiceNow update set XML from a manifest-driven
 * source directory.
 *
 * Usage:
 *   node scripts/build-update-set.js <source-dir>
 *
 * Example:
 *   node scripts/build-update-set.js scratch/global-changes/fsm-bridge/
 *
 * Reads:
 *   <source-dir>/manifest.yaml
 *   <source-dir>/source/*.js  (referenced by manifest artifacts)
 *
 * Produces in dist/update-sets/<basename>/:
 *   update-set.xml       — the importable artifact (load via Studio)
 *   update-set.sha256    — content hash for tamper evidence
 *   impact.md            — human-readable summary derived from manifest
 *   preview.md           — what to expect on import (record types + counts)
 *
 * Update sets are ServiceNow's documented security boundary for global-scope
 * changes. This generator produces the same XML format ServiceNow itself
 * emits via "Export to XML" on a completed update set, so the output can
 * be imported via System Update Sets > Retrieved Update Sets > Import.
 *
 * For enterprise environments with ServiceNow Vault, the generated XML can
 * additionally be signed via a Signing Job on a trusted instance before
 * being committed on the protected instance. See:
 *   servicenow-docs/markdown/platform-security/sign-specific-records.md
 *
 * Supported artifact types:
 *   - dictionary_entry  (sys_dictionary)         — adds a custom field to a table
 *   - business_rule     (sys_script)             — adds a server-side BR
 *   - catalog_item      (sc_cat_item + children) — creates a catalog item with
 *                                                  nested item_option_new variables,
 *                                                  question_choice values, and
 *                                                  optional sc_cat_item_category
 *                                                  mappings. One manifest entry
 *                                                  emits multiple sys_update_xml
 *                                                  records under the same parent.
 *
 * Phase 2 backlog: sys_db_object (new tables), sys_choice (choice values),
 * sys_ui_policy, sys_ui_action, sys_script_include (global scope).
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const yaml = require('js-yaml')

const REPO_ROOT = path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// Manifest loading
// ---------------------------------------------------------------------------

function loadManifest(sourceDir) {
    const manifestPath = path.join(sourceDir, 'manifest.yaml')
    if (!fs.existsSync(manifestPath)) {
        die(`manifest.yaml not found at ${manifestPath}`)
    }
    let manifest
    try {
        manifest = yaml.load(fs.readFileSync(manifestPath, 'utf8'))
    } catch (e) {
        die(`Failed to parse manifest.yaml: ${e.message}`)
    }
    if (!manifest.name) die('manifest.yaml: name is required')
    if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
        die('manifest.yaml: artifacts must be a non-empty array')
    }
    return manifest
}

// ---------------------------------------------------------------------------
// Deterministic sys_id generation
//
// ServiceNow sys_ids are 32-char hex. We generate them deterministically from
// (update set name, artifact identifier) so re-generating the same manifest
// produces the same sys_ids — which lets ServiceNow recognize updates rather
// than inserts on re-import.
// ---------------------------------------------------------------------------

function deterministicSysId(...parts) {
    const input = parts.filter(Boolean).join('|')
    return crypto.createHash('sha1').update(input).digest('hex').slice(0, 32)
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function xmlEscape(s) {
    if (s == null) return ''
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

function cdata(s) {
    if (s == null) return ''
    // Defensively split any embedded ']]>' sequence (rare but possible)
    return '<![CDATA[' + String(s).replace(/]]>/g, ']]]]><![CDATA[>') + ']]>'
}

function tag(name, value, opts = {}) {
    if (value === undefined || value === null) return `<${name}/>`
    if (opts.cdata) return `<${name}>${cdata(value)}</${name}>`
    return `<${name}>${xmlEscape(value)}</${name}>`
}

// ---------------------------------------------------------------------------
// Artifact builders — each returns the inner <record_update>...</record_update>
// ---------------------------------------------------------------------------

function buildDictionaryEntry(art, updateSetName) {
    const sysId = deterministicSysId(updateSetName, 'sys_dictionary', art.table, art.element)
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<record_update table="sys_dictionary">',
        '  <sys_dictionary action="INSERT_OR_UPDATE">',
        `    ${tag('sys_id', sysId)}`,
        `    ${tag('name', art.table)}`,
        `    ${tag('element', art.element)}`,
        `    ${tag('column_label', art.column_label)}`,
        `    ${tag('internal_type', art.internal_type)}`,
        `    ${tag('default_value', art.default_value)}`,
        `    ${tag('active', art.active !== false)}`,
        `    ${tag('mandatory', art.mandatory === true)}`,
        `    ${tag('read_only', art.read_only === true)}`,
        `    ${tag('comments', art.description)}`,
        `    ${tag('sys_update_name', `sys_dictionary_${art.table}_${art.element}`)}`,
        '  </sys_dictionary>',
        '</record_update>',
    ]
    return {
        sysId,
        targetName: `${art.table}.${art.element}`,
        type: 'Dictionary',
        sysUpdateName: `sys_dictionary_${art.table}_${art.element}`,
        payload: lines.join('\n'),
    }
}

function buildBusinessRule(art, sourceDir, updateSetName) {
    if (!art.script_file) die(`business_rule "${art.name}": script_file is required`)
    const scriptPath = path.join(sourceDir, art.script_file)
    if (!fs.existsSync(scriptPath)) die(`business_rule "${art.name}": script_file not found: ${scriptPath}`)
    const script = fs.readFileSync(scriptPath, 'utf8')

    const sysId = deterministicSysId(updateSetName, 'sys_script', art.table, art.name)
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<record_update table="sys_script">',
        '  <sys_script action="INSERT_OR_UPDATE">',
        `    ${tag('sys_id', sysId)}`,
        `    ${tag('name', art.name)}`,
        `    ${tag('collection', art.table)}`,
        `    ${tag('description', art.description)}`,
        `    ${tag('when', art.when || 'after')}`,
        `    ${tag('order', art.order ?? 100)}`,
        `    ${tag('active', art.active !== false)}`,
        `    ${tag('advanced', art.advanced !== false)}`,
        `    ${tag('action_insert', art.action_insert === true)}`,
        `    ${tag('action_update', art.action_update === true)}`,
        `    ${tag('action_query', art.action_query === true)}`,
        `    ${tag('action_delete', art.action_delete === true)}`,
        `    ${tag('condition', art.condition || '')}`,
        `    <script>${cdata(script)}</script>`,
        `    ${tag('sys_update_name', `sys_script_${sysId}`)}`,
        '  </sys_script>',
        '</record_update>',
    ]
    return {
        sysId,
        targetName: art.name,
        type: 'Business Rule',
        sysUpdateName: `sys_script_${sysId}`,
        payload: lines.join('\n'),
    }
}

// ---------------------------------------------------------------------------
// catalog_item builder
//
// One manifest entry → multiple sys_update_xml records (item + variables +
// choices + additional category mappings), all under the same parent
// update set. Returns an array of artifact records.
// ---------------------------------------------------------------------------

function buildCatalogItem(art, updateSetName) {
    if (!art.name) die('catalog_item: name is required')
    const itemSysId = deterministicSysId(updateSetName, 'sc_cat_item', art.name)
    const sysUpdateName = `sc_cat_item_${itemSysId}`

    // sc_cat_item fields — minimal-but-sufficient set, matching the shape
    // ServiceNow itself emits when exporting an item to XML. Booleans render
    // as 'true' / 'false' to match the platform's serialization.
    const itemLines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<record_update table="sc_cat_item">',
        '  <sc_cat_item action="INSERT_OR_UPDATE">',
        `    ${tag('sys_id', itemSysId)}`,
        `    ${tag('name', art.name)}`,
        `    ${tag('sys_name', art.name)}`,
        `    ${tag('short_description', art.short_description)}`,
        `    <description>${cdata(art.description || '')}</description>`,
        `    ${tag('price', art.price ?? 0)}`,
        `    ${tag('cost', art.cost ?? 0)}`,
        `    ${tag('recurring_price', art.recurring_price ?? 0)}`,
        `    ${tag('list_price', art.list_price ?? 0)}`,
        `    ${tag('active', art.active !== false)}`,
        `    ${tag('billable', art.billable === true)}`,
        `    ${tag('availability', art.availability || 'on_desktop')}`,
        `    ${tag('access_type', art.access_type || 'restricted')}`,
        `    ${tag('roles', art.roles || '')}`,
        `    ${tag('sc_catalogs', art.catalogs || art.sc_catalogs || '')}`,
        `    ${tag('category', art.category || '')}`,
        `    ${tag('delivery_time', art.delivery_time || '')}`,
        `    ${tag('type', art.type_subtype || 'item')}`,
        `    ${tag('use_sc_layout', art.use_sc_layout !== false)}`,
        `    ${tag('visible_bundle', art.visible_bundle !== false)}`,
        `    ${tag('visible_guide', art.visible_guide !== false)}`,
        `    ${tag('visible_standalone', art.visible_standalone !== false)}`,
        `    ${tag('mobile_picture_type', art.mobile_picture_type || 'use_desktop_picture')}`,
        `    ${tag('display_price_property', art.display_price_property || 'non_zero')}`,
        `    ${tag('fulfillment_automation_level', art.fulfillment_automation_level || 'semi_automated')}`,
        `    ${tag('owner', art.owner || '')}`,
        `    ${tag('flow_designer_flow', art.flow_designer_flow || '')}`,
        `    ${tag('sys_scope', art.application || 'global')}`,
        `    ${tag('sys_class_name', 'sc_cat_item')}`,
        `    ${tag('sys_update_name', sysUpdateName)}`,
        '  </sc_cat_item>',
        '</record_update>',
    ]
    const results = [{
        sysId: itemSysId,
        targetName: art.name,
        type: 'Catalog Item',
        sysUpdateName,
        payload: itemLines.join('\n'),
    }]

    // Variables (item_option_new) + their choices (question_choice)
    const variables = Array.isArray(art.variables) ? art.variables : []
    for (const v of variables) {
        if (!v.name) die(`catalog_item "${art.name}": variable.name is required`)
        const varSysId = deterministicSysId(updateSetName, 'item_option_new', art.name, v.name)
        const varUpdateName = `item_option_new_${varSysId}`
        const varLines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<record_update table="item_option_new">',
            '  <item_option_new action="INSERT_OR_UPDATE">',
            `    ${tag('sys_id', varSysId)}`,
            `    ${tag('cat_item', itemSysId)}`,
            `    ${tag('name', v.name)}`,
            `    ${tag('sys_name', v.question_text || v.name)}`,
            `    ${tag('question_text', v.question_text || v.name)}`,
            `    ${tag('type', v.type ?? 3)}`,
            `    ${tag('order', v.order ?? 100)}`,
            `    ${tag('mandatory', v.mandatory === true)}`,
            `    ${tag('active', v.active !== false)}`,
            `    ${tag('read_only', v.read_only === true)}`,
            `    ${tag('default_value', v.default_value || '')}`,
            `    ${tag('layout', v.layout || 'normal')}`,
            `    ${tag('visibility', v.visibility ?? 1)}`,
            `    ${tag('do_not_select_first', v.do_not_select_first === true)}`,
            `    ${tag('include_none', v.include_none === true)}`,
            `    ${tag('visible_bundle', v.visible_bundle !== false)}`,
            `    ${tag('visible_guide', v.visible_guide !== false)}`,
            `    ${tag('visible_standalone', v.visible_standalone !== false)}`,
            `    ${tag('sys_scope', art.application || 'global')}`,
            `    ${tag('sys_class_name', 'item_option_new')}`,
            `    ${tag('sys_update_name', varUpdateName)}`,
            '  </item_option_new>',
            '</record_update>',
        ]
        results.push({
            sysId: varSysId,
            targetName: `${art.name} :: ${v.name}`,
            type: 'Variable',
            sysUpdateName: varUpdateName,
            payload: varLines.join('\n'),
        })

        const choices = Array.isArray(v.choices) ? v.choices : []
        for (const c of choices) {
            if (c.value === undefined || c.value === null) {
                die(`catalog_item "${art.name}" variable "${v.name}": choice.value is required`)
            }
            const choiceSysId = deterministicSysId(
                updateSetName, 'question_choice', art.name, v.name, String(c.value)
            )
            const choiceUpdateName = `question_choice_${choiceSysId}`
            const choiceLines = [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<record_update table="question_choice">',
                '  <question_choice action="INSERT_OR_UPDATE">',
                `    ${tag('sys_id', choiceSysId)}`,
                `    ${tag('question', varSysId)}`,
                `    ${tag('text', c.text || String(c.value))}`,
                `    ${tag('value', c.value)}`,
                `    ${tag('order', c.order ?? 100)}`,
                `    ${tag('misc', c.misc ?? 0)}`,
                `    ${tag('inactive', c.inactive === true)}`,
                `    ${tag('sys_name', c.text || String(c.value))}`,
                `    ${tag('sys_scope', art.application || 'global')}`,
                `    ${tag('sys_class_name', 'question_choice')}`,
                `    ${tag('sys_update_name', choiceUpdateName)}`,
                '  </question_choice>',
                '</record_update>',
            ]
            results.push({
                sysId: choiceSysId,
                targetName: `${art.name} :: ${v.name} = ${c.value}`,
                type: 'Question Choice',
                sysUpdateName: choiceUpdateName,
                payload: choiceLines.join('\n'),
            })
        }
    }

    // Additional categories (sc_cat_item_category m2m). The primary category
    // already lives on sc_cat_item.category above; this list is for any extras.
    const extraCats = Array.isArray(art.additional_categories) ? art.additional_categories : []
    for (const catSysId of extraCats) {
        const mapSysId = deterministicSysId(
            updateSetName, 'sc_cat_item_category', art.name, catSysId
        )
        const mapUpdateName = `sc_cat_item_category_${mapSysId}`
        const mapLines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<record_update table="sc_cat_item_category">',
            '  <sc_cat_item_category action="INSERT_OR_UPDATE">',
            `    ${tag('sys_id', mapSysId)}`,
            `    ${tag('sc_cat_item', itemSysId)}`,
            `    ${tag('sc_category', catSysId)}`,
            `    ${tag('sys_scope', art.application || 'global')}`,
            `    ${tag('sys_class_name', 'sc_cat_item_category')}`,
            `    ${tag('sys_update_name', mapUpdateName)}`,
            '  </sc_cat_item_category>',
            '</record_update>',
        ]
        results.push({
            sysId: mapSysId,
            targetName: `${art.name} -> category ${catSysId}`,
            type: 'Catalog Item Category',
            sysUpdateName: mapUpdateName,
            payload: mapLines.join('\n'),
        })
    }

    return results
}

function buildArtifact(art, sourceDir, updateSetName) {
    switch (art.type) {
        case 'dictionary_entry':
            return [buildDictionaryEntry(art, updateSetName)]
        case 'business_rule':
            return [buildBusinessRule(art, sourceDir, updateSetName)]
        case 'catalog_item':
            return buildCatalogItem(art, updateSetName)
        default:
            die(`Unknown artifact type: ${art.type}`)
    }
}

// ---------------------------------------------------------------------------
// Outer update set XML
// ---------------------------------------------------------------------------

function buildUpdateSetXml(manifest, artifacts) {
    const usSysId = deterministicSysId('sys_remote_update_set', manifest.name)
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const application = manifest.application || 'global'

    const usHeader = [
        '  <sys_remote_update_set action="INSERT_OR_UPDATE">',
        `    ${tag('sys_id', usSysId)}`,
        `    ${tag('name', manifest.name)}`,
        `    ${tag('description', manifest.description || '')}`,
        `    ${tag('state', 'loaded')}`,
        `    ${tag('application', application)}`,
        `    ${tag('release_date', now)}`,
        `    ${tag('inserted', now)}`,
        '  </sys_remote_update_set>',
    ].join('\n')

    const usXmlEntries = artifacts.map((art) => {
        const payloadHash = crypto.createHash('sha256').update(art.payload).digest('hex')
        return [
            '  <sys_update_xml action="INSERT_OR_UPDATE">',
            `    ${tag('action', 'INSERT_OR_UPDATE')}`,
            `    ${tag('name', art.sysUpdateName)}`,
            `    ${tag('target_name', art.targetName)}`,
            `    ${tag('type', art.type)}`,
            `    ${tag('category', 'customer')}`,
            `    ${tag('update_domain', 'global')}`,
            `    ${tag('replace_on_upgrade', false)}`,
            `    ${tag('payload_hash', payloadHash)}`,
            `    ${tag('remote_update_set', usSysId)}`,
            `    <payload>${xmlEscape(art.payload)}</payload>`,
            '  </sys_update_xml>',
        ].join('\n')
    }).join('\n')

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<unload unload_date="${now}">`,
        usHeader,
        usXmlEntries,
        '</unload>',
        '',
    ].join('\n')
}

// ---------------------------------------------------------------------------
// Companion outputs
// ---------------------------------------------------------------------------

function buildImpactMd(manifest, artifacts) {
    const lines = [
        `# Impact summary: ${manifest.name}`,
        '',
        manifest.description ? manifest.description.trim() : '',
        '',
        '## Intent',
        '',
        manifest.intent ? manifest.intent.trim() : '_(not specified)_',
        '',
        '## Artifacts in this update set',
        '',
    ]
    for (const a of artifacts) {
        lines.push(`- **${a.type}** \`${a.targetName}\` — ${a.sysUpdateName}`)
    }
    lines.push('')

    if (manifest.estimated_impact) {
        const e = manifest.estimated_impact
        lines.push('## Estimated impact')
        lines.push('')
        if (Array.isArray(e.tables_modified)) {
            lines.push(`- Tables modified: ${e.tables_modified.map((t) => `\`${t}\``).join(', ')}`)
        }
        if ('bulk_data_changes' in e) {
            lines.push(`- Bulk data changes: ${e.bulk_data_changes ? 'YES — review carefully' : 'no'}`)
        }
        if (e.rollback_complexity) {
            lines.push(`- Rollback complexity: **${e.rollback_complexity}**`)
        }
        if (e.notes) {
            lines.push('')
            lines.push('### Notes')
            lines.push('')
            lines.push(e.notes.trim())
        }
        lines.push('')
    }

    lines.push('## Gating checklist')
    lines.push('')
    lines.push('Before importing this update set to a target instance:')
    lines.push('')
    lines.push('- [ ] Generated XML hash (sha256) matches `update-set.sha256`')
    lines.push('- [ ] Reviewer has read the source files in `source/`')
    lines.push('- [ ] Target instance state has been previewed (see `preview.md`)')
    lines.push('- [ ] CAB / change-management approval recorded (if applicable)')
    lines.push('- [ ] Rollback procedure understood (see notes above)')
    lines.push('')
    lines.push('On the target instance:')
    lines.push('')
    lines.push('1. **System Update Sets > Retrieved Update Sets > Import Update Set from XML**')
    lines.push('2. Upload `update-set.xml`')
    lines.push('3. Open the loaded update set, click **Preview Update Set**')
    lines.push('4. Resolve any preview errors')
    lines.push('5. Click **Commit Update Set**')
    lines.push('6. Verify expected changes via `scripts/python/preview-update-set.py --post-import`')
    return lines.join('\n') + '\n'
}

function buildPreviewMd(manifest, artifacts) {
    const lines = [
        `# Pre-import preview: ${manifest.name}`,
        '',
        'This document describes what will happen when this update set is',
        'imported and committed on the target instance. Compare against the',
        'instance\'s own Preview Update Set output before committing.',
        '',
        '## Records this update set will INSERT_OR_UPDATE',
        '',
        '| Type | Target | sys_update_name |',
        '| ---- | ------ | --------------- |',
    ]
    for (const a of artifacts) {
        lines.push(`| ${a.type} | \`${a.targetName}\` | \`${a.sysUpdateName}\` |`)
    }
    lines.push('')
    lines.push('## What to expect during Preview Update Set')
    lines.push('')
    lines.push('- ServiceNow will compare each `sys_update_xml` entry against the')
    lines.push('  current state of the target. New artifacts show as **Inserts**,')
    lines.push('  existing ones show as **Updates** with a field-level diff.')
    lines.push('- Any reference fields (e.g. table references in `sys_dictionary`)')
    lines.push('  will be resolved against the target instance. If a referenced')
    lines.push('  record does not exist, the preview will surface a warning.')
    lines.push('- For dictionary entries: confirm the target table exists. The new')
    lines.push('  field will be created with no value on existing records.')
    lines.push('- For business rules: confirm the `collection` (table) exists and')
    lines.push('  the condition syntax is valid against current field names.')
    return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function die(msg) {
    console.error(`ERROR: ${msg}`)
    process.exit(1)
}

function main() {
    const argSource = process.argv[2]
    if (!argSource) die('Usage: node scripts/build-update-set.js <source-dir>')
    const sourceDir = path.resolve(argSource)
    if (!fs.existsSync(sourceDir)) die(`Source directory not found: ${sourceDir}`)

    const manifest = loadManifest(sourceDir)
    console.log(`Building update set: ${manifest.name}`)
    console.log(`  Source:      ${sourceDir}`)
    console.log(`  Artifacts:   ${manifest.artifacts.length}`)

    const builtArtifacts = manifest.artifacts.flatMap((art) => buildArtifact(art, sourceDir, manifest.name))
    const xml = buildUpdateSetXml(manifest, builtArtifacts)
    const xmlHash = crypto.createHash('sha256').update(xml).digest('hex')

    // Write generated artifacts to `<source-dir>/built/` so reviewers see the
    // source, the artifact, and the impact analysis side-by-side in the PR.
    // Override with --out <dir> if you want output elsewhere (e.g. for local
    // testing where you don't want to dirty the source folder).
    const argOut = process.argv.find((_, i, arr) => arr[i - 1] === '--out')
    const outDir = argOut
        ? path.resolve(argOut)
        : path.join(sourceDir, 'built')
    fs.mkdirSync(outDir, { recursive: true })

    const outXml = path.join(outDir, 'update-set.xml')
    const outHash = path.join(outDir, 'update-set.sha256')
    const outImpact = path.join(outDir, 'impact.md')
    const outPreview = path.join(outDir, 'preview.md')

    fs.writeFileSync(outXml, xml)
    fs.writeFileSync(outHash, `${xmlHash}  update-set.xml\n`)
    fs.writeFileSync(outImpact, buildImpactMd(manifest, builtArtifacts))
    fs.writeFileSync(outPreview, buildPreviewMd(manifest, builtArtifacts))

    console.log(`\nWrote:`)
    console.log(`  ${path.relative(REPO_ROOT, outXml)}     (${fs.statSync(outXml).size} bytes)`)
    console.log(`  ${path.relative(REPO_ROOT, outHash)}    (sha256: ${xmlHash.slice(0, 16)}...)`)
    console.log(`  ${path.relative(REPO_ROOT, outImpact)}`)
    console.log(`  ${path.relative(REPO_ROOT, outPreview)}`)
    console.log(`\nNext steps:`)
    console.log(`  1. Review ${path.relative(REPO_ROOT, outImpact)}`)
    console.log(`  2. Commit the change folder to the global-changes repo`)
    console.log(`  3. Import update-set.xml via Studio (Retrieved Update Sets)`)
    console.log(`  4. Preview → Commit on target instance`)
}

main()
