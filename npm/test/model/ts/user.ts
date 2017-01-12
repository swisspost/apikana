interface Users {
    users: User[];
}

interface User {
    id: number;
    firstName: string //the given name
    lastName: string; //the family name
    age?: number;
}
