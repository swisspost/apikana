interface Users {
    users: User[];
}

interface User {
    id: number;
    firstName: string //Alarming-Type. String is used to faciliate enhancement. New Alarming-Types can be added if the fit any of the existing configuration structures.
    lastName: string; // optional. set if type=SECURITY_ISSUE_ALARM
    age?: number;
}
