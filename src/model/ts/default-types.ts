
/**
 * <a href="https://swagger.io/docs/specification/data-models/data-types/#numbers">Number @type integer</a>
 */
export type Int=number // @type integer

/**
 * <a href="https://swagger.io/docs/specification/data-models/data-types/#numbers">Number @type integer</a> as signed 64-bit long integer.
 */
export type Long=number // @type integer @minimum -9223372036854775000 @maximum 9223372036854775000 @format long

/**
 * <a href="https://swagger.io/docs/specification/data-models/data-types/#string">String @format date-time</a>,
 * as defined by <a href="https://tools.ietf.org/html/rfc3339#section-5.6">RFC 3339, section 5.6</a>,
 * for example: <code>2014-05-22T10:42:42.542+00:00</code>.
 */
export type DateTime=string // @format date-time

/**
 * <a href="https://swagger.io/docs/specification/data-models/data-types/#string">String @format date</a>,
 * as defined by <a href="https://tools.ietf.org/html/rfc3339#section-5.6">RFC 3339, section 5.6</a>,
 * for example: <code>2017-07-21</code>.
 */
export type DateOnly=string // @format date

/**
 * Partial-time notation as defined by <a href="https://tools.ietf.org/html/rfc3339#section-5.6">RFC 3339, section 5.6</a>,
 * for example, <code>23:59:59</code>.
 */
export type TimeOnly=string // @format time

/**
 * <a href="https://swagger.io/docs/specification/data-models/data-types/#string">String @format uuid</a>
 * (even '@format uuid' is not specified).
 */
export type UUID=string // @format uuid

/**
 * <a href="https://swagger.io/docs/specification/data-models/data-types/#numbers">Number @format utc-millisec</a>
 * (even '@format utc-millisec' is not specified).
 */
export type UTC=number // @format utc-millisec
