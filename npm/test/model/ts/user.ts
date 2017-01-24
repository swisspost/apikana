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
     * @pattern [a-z]
     */
    firstName: string //the given name
    lastName: string //the family name
    /**
     * @format integer
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

