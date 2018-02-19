import {CompanyInfo, UUID} from "./company";
import {Int} from "apikana/default-types";

// import {Gender} from "acorn/gender";

export interface Users {
    count: number
    data: User[]
}

var a; //ignore too!

/**
 * dfgljfh df lh ölf // ignore!
 * @type string
 *
 */
export enum Gender {
    MALE, FEMALE
}

export interface User {
    /**
     * the id
     */
    id: UUID
    /**
     * the given name
     * @pattern [a-z]
     * @asType dfl
     * @description afasdfsd
     */
    firstName: string // @asType integer
    lastName: string // the family name @pattern [A-Z] because
    anInt: string // @type integer bla
    age?: Int
    gender: Gender
    birthday: string // @format date-time, hula
    parent?: User
    company: CompanyInfo
    properties?: { [key: string]: Int }
    type: string
}

/**
 * base
 */
export interface Base {
    a: Int
}

interface Base2 {
    b: Int
}

export interface ExtNix extends Base {
}

/**
 * ext
 */
export interface Ext extends Base {
    c: Int
}

/**
 * ext ext
 */
export interface ExtExt extends Ext {
    d: Int
}

export interface Ext2 extends User, Base2 {
    e: Int
}

export enum EnumSimple {
    A, B
}

/**
 * @type integer
 */
export enum EnumSimpleInt {
    A, B
}

/**
 * @type string
 */
export enum EnumSimpleString {
    A, B
}

/**
 * @type integer
 */
export enum EnumValueInt {
    A = 5, B
}

export enum EnumValueString {
    A = "a1" as any,
    B = "b2" as any
}

export enum EnumValueMix {
    A = 5,
    B = "b2" as any
}

