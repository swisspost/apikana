package apikana.test;
Path.Alarmings.path
Path.Alarmings.uuid.path
Path.Alarmings.uuid.Cancel.path
Path.Alarmings.uuid.Cancel.Request.path
Path.Alarmings.uuid.Cancel.Request.element
Path.Alarmings.uuid.Status.path
Path.Alarmings.uuid.CancelRequest.element
Path.Alarmings.uuid.Status.element
Path.Alarmings.uuid.element
Path.Alarmings.uuidCancelRequest.element
Path.Alarmings.uuidStatus.element
Path.Alarmings.uuid.param
interface Path{}
interface Param{}
interface Elem{}

public class Paths {
    public static String path(Path path){}
    public static String url(Path path){}
    public static String url(String base,Path path){}
    public static String param(Param param){}
    public static String elem(Elem elem){}
    public static final String baseUrl="http://bla/";
    public static final String path="communication/alarming/v1/";

    class Alarmings implements Path{
        class Uuid implements Path,Elem,Param{
            class Cancel implements Path{
                class Request implements Path,Elem{}
            }
            class Status implements Path,Elem{}
            class CancelRequest implements Elem{}
        }
        class UuidCancelRequest implements Elem{}
        class UuidStatus implements Elem{}
    }
}

public class Paths {
    public static final String
        ALARMINGS = "communication/alarming/v1/alarmings/";
        ALARMINGS_uuid = "communication/alarming/v1/alarmings/{uuid}/";
        ALARMINGS_uuid_CANCEL = "communication/alarming/v1/alarmings/{uuid}/cancel/";
        ALARMINGS_uuid_CANCEL_REQUEST = "communication/alarming/v1/alarmings/{uuid}/cancel/request";
        ALARMINGS_uuid_CANCEL$REQUEST = "request";
        ALARMINGS_uuid_STATUS = "communication/alarming/v1/alarmings/{uuid}/status";
        ALARMINGS_uuid$CANCEL_REQUEST = "cancel/request";
        ALARMINGS_uuid$STATUS = "status";
        ALARMINGS$uuid = "{uuid}";
        ALARMINGS$uuid_CANCEL_REQUEST = "{uuid}/cancel/request";
        ALARMINGS$uuid_STATUS = "{uuid}/status";
        ALARMINGS$uuid$ = "uuid";
        ANTRITTSCHECK = "communication/alarming/v1/antrittscheck/";
        ANTRITTSCHECK_ALARMINGS = "communication/alarming/v1/antrittscheck/alarmings/";
        ANTRITTSCHECK_ALARMINGS_uuid = "communication/alarming/v1/antrittscheck/alarmings/{uuid}/";
        ANTRITTSCHECK_ALARMINGS_uuid_CONTEXT = "communication/alarming/v1/antrittscheck/alarmings/{uuid}/context";
        ANTRITTSCHECK_ALARMINGS_uuid$CONTEXT = "context";
        ANTRITTSCHECK_ALARMINGS$uuid = "{uuid}";
        ANTRITTSCHECK_ALARMINGS$uuid_CONTEXT = "{uuid}/context";
        ANTRITTSCHECK_ALARMINGS$uuid$ = "uuid";
        ANTRITTSCHECK$ALARMINGS_uuid_CONTEXT = "alarmings/{uuid}/context";
        USERS = "sample/v1/users";
        USERS_id = "sample/v1/users/{id}";
        USERS$id = "{id}";
        USERS$id$ = "id";
}