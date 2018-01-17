import {CompanyInfo, UUID} from "./company";
import {Int} from "apikana/default-types";

// import {Gender} from "acorn/gender";

export interface Users {
    count: number
    data: User[]
}

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
    birthday: string // @format date-time hula
    parent?: User
    company: CompanyInfo
    properties?: { [key: string]: Int }
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


