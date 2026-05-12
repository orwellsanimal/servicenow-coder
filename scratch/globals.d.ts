/**
 * Ambient type declarations for vanilla GlideScript development.
 * Re-exports @servicenow/glide types as globals, matching the
 * ServiceNow server-side scripting environment.
 */
import type {
    GlideRecord,
    GlideElement,
    GlideSystem,
    GlideAggregate,
    GlideDateTime,
    GlideFilter,
    GlideSysAttachment,
    GlideQueryCondition,
} from '@servicenow/glide';

declare global {
    const gs: GlideSystem;
    const current: GlideRecord;
    const previous: GlideRecord;

    type GlideRecordType<T extends string = string> = GlideRecord<T>;
    type GlideElementType = GlideElement;
    type GlideAggregateType = GlideAggregate;
    type GlideDateTimeType = GlideDateTime;
    type GlideFilterType = GlideFilter;
    type GlideSysAttachmentType = GlideSysAttachment;
    type GlideQueryConditionType = GlideQueryCondition;

    // Re-declare constructors as globals
    const GlideRecord: GlideRecord;
    const GlideAggregate: GlideAggregate;
    const GlideDateTime: GlideDateTime;
    const GlideSysAttachment: GlideSysAttachment;
}

export {};
