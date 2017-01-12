//ToDo: viele weitere Ausgänge der Alarming Sequence sind denkbar. Auch abhängig von den Möglichkeiten, die der externe Alarming-Anbieter bietet.
enum AlarmingStatusType {
    INITIALIZED,    //An alarminrequest was submitted by a client
    NOT_FOUND,      //No Configuration was found for an alarming submitted by a client
    SEQUENCE_STARTING, //The Sequence was sucessfully prepared the external Service will now be called
    SEQUENCE_STARTED, //The external Service was called
    SEQUENCE_SUCCESS, //One of the recipients confirmed the alarming request positive
    SEQUENCE_TIMEOUT, //No confirmation until a deadline was reached
    SEQUENCE_ABORTED,  //The alarming sequence was aborted abnormally
    SEQUENCE_DECLINED,  //All recepients confirmed the call negative
        //Any of the following cancellations leads to an abortion of an Alarming-Call-Sequence. Even if it is already running
    CANCELLED_OBSOLETE, //The call was cancelled because the alarming reason is obsolete (eg the driver logged in to late)
    CANCELLED_FALSE_ALARM, //The call was cancelled because the alarming was initiated by mistake
    CANCELLED_OTHER, //Any other reason to cancel an alarming
        //Special State
    CANCELLED_AFTER_SUCCESS //The Alarming-Call-Sequence has already finished successful (eg. one of the callees confirmed positive)
}

enum CancelReasonType{
    OBSOLETE, //The call was cancelled because the alarming reason is obsolete (eg the driver logged in to late)
    FALSE_ALARM, //The call was cancelled because the alarming was initiated by mistake
    OTHER, //Any other reason to cancel an alarming
    NOT_CANCELLED
}


//ToDo: Ist sowas wirklich nötig? Grundsätzlich sind Alarmingfälle wohl immer von höchster Priorität.
// Solch grosse Mengen dass eine Priorisierung notwendig wird sind eigentlich nicht zu erwarten
enum AlarmingPriority {
    LOW,
    MEDIUM,
    HIGH,
    HIGHEST
}

enum RecipientState{
    MISSED, //The recipient did not respond to the call
    CONFIRMED, //the recipient confirmed the call. -> positive reaction. This would be the endpoint of a call chain
    REJECTED, //the recepient rejected the call -> negative reaction. This would trigger the call to the next recipient in a call chain.
    CALLED,  //The recipient was called. No reaction yet.
    QUEUED  // The recipient is in a call chain but not on top of it.
}

//The idea is to use this enum bitwise. Probably a recipient is addressed via different media.
enum Device{
    MAIL = 1 << 0, // 1
    SMS = 1 << 1,  // 2
    PHONE= 1 << 2,  // 4
    APP= 1 << 3 // 8
}

//ToDo: SecurityIssues sind noch nicht spezifiziert.
enum SecurityIssueType{
    ANY_ISSUE
}

interface Alarmings{
    alarms: Alarming[]; //List of alarms
}

interface Alarming{
    uuid: string; //UUID of an Alarming. This information is redundant (Passed also in URL)
    type: string //Alarming-Type. String is used to faciliate enhancement. New Alarming-Types can be added if the fit any of the existing configuration structures.
    securityIssueAlarming?: SecurityIssueAlarming; // optional. set if type=SECURITY_ISSUE_ALARM
    entranceCheckAlarming?: EntranceCheckAlarming; // optional. set if type=ENTRANCE_CHECK_ALARM
    returnCheckAlarming?: ReturnCheckAlarming; // optional. set if type=RETURN_CHECK_ALARM
    googleplexAlarming?: GoogleplexAlarming; // optional. set if type=GOOGLEPLEX_ALARM
}


interface EntranceCheckAlarming{
    tripId: string;
    userId: string;
}

interface ReturnCheckAlarming{
    tripId: string;
    userId: string;
}

//ToDo: SecurityIssues sind noch nicht spezifiziert.
interface SecurityIssueAlarming{
    issueType: SecurityIssueType;
    issueId: string;
}

//ToDo: SecurityIssues sind noch nicht spezifiziert.
interface GoogleplexAlarming{
    issueId: string;
}

interface AlarmingStatus {
    state: AlarmingStatusType;
    progress: AlarmingProgress;
}

interface CancelRequest {
    reason: CancelReasonType;
}

//Contains information on an active or finished Alarming
//communication/alarming/v1/services/{servicename}/alarms/{alarmid}/alarmstate
interface AlarmingProgress{
    id: string; //UUID of an Alarming - Equal to Alarming:id. This information is redundant (Passed also in URL)
    state: AlarmingStatus;
    recipients: AlarmingRecipient[];
}


//Contains the information of a single call ro a recipient
interface AlarmingRecipient{
    recipientId: string;
    startTime: string;      //Time when the call to this recipient was started. @format date-time
    endTime: string;     //Time when the call to this recipient was ended for any reason. @format date-time
    devices: Device;       //Devices used for the call
    confirmationDevice: Device;
    state: RecipientState;   //State of the call
}



//ToDo: Some issues:
// expiration: string; // Die Gültigkeitsdauer eines Alarmings wird bei den Alarming-Regeln konfigurativ hinterlegt. Der Aufrufer kann das nicht bestimmen.
// priority: AlarmingingPriority; //Die Priorität eines Alarmings wird bei den Alarming-Regeln konfigurativ hinterlegt. Der Aufrufer kann das nicht bestimmen.