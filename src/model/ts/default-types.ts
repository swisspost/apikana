
/**
 * <p>Alias for Swagger type <a href="https://swagger.io/docs/specification/data-models/data-types/#numbers">number @type integer</a>.</p>
 */
export type Int=number // @asType integer

/**
 * <p>The date-time notation as defined by <a href="https://tools.ietf.org/html/rfc3339#section-5.6">RFC 3339, section 5.6</a>,
 * for example <code>2014-05-22T10:42:42.542+00:00</code>.</p>
 *
 * <p>See: <a href="https://swagger.io/docs/specification/data-models/data-types/#string">string @format date-time</a>.</p>
 */
export type DateTime=string // @format date-time

/**
 * <p>full-date notation as defined by <a href="https://tools.ietf.org/html/rfc3339#section-5.6">RFC 3339, section 5.6</a>,
 * for example, 2017-07-21</p>
 *
 * <p>See: <a href="https://swagger.io/docs/specification/data-models/data-types/#string">string @format date</a>.</p>
 */
export type DateOnly=string // @format date

/**
 * <p>partial-time notation as defined by <a href="https://tools.ietf.org/html/rfc3339#section-5.6">RFC 3339, section 5.6</a>,
 * for example, <code>23:59:59</code>.</p>
 */
export type TimeOnly=string // @format time

/**
 * <p>Alias for swagger type <a href="https://swagger.io/docs/specification/data-models/data-types/#string">string @format uuid</a>
 * (even '@format uuid' is not specified).</p>
 */
export type UUID=string // @format uuid

/**
 * <p>Alias for swagger type <a href="https://swagger.io/docs/specification/data-models/data-types/#numbers">number @format utc-millisec</a>
 * (even '@format utc-millisec' is not specified).</p>
 */
export type UTC=number // @format utc-millisec
