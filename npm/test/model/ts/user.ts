import {Company} from "company";

interface Users {
    count: number
    data: User[]
}

interface User {
    /**
     * the id
     */
    id: number
    /**
     * the given name
     * @pattern [a-z]
     *
     */
    firstName: string
    lastName: string // the family name @pattern [A-Z]
    /**
     * @type integer
     * @format integer
     * @pattern bla
     * @bla blu
     */
    age?: number
    parent?: User
    company: Company
}

type Companies = Company[];
interface List<T> {
    values: T[];
}
interface UserList extends List<User> {
}

