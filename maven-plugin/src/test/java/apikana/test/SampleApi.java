package apikana.test;

public class SampleApi {
    public static final String BASE_URL = "https://base";
    private static abstract class Path {
        public abstract String path();
        public String url() {
            return BASE_URL + path();
        }
        public String url(String base) {
            return base + path();
        }
    }
    public static V1 v1 = new V1();
    public static class V1 extends Path {
        public static final String PATH = "sample/v1";
        private V1(){}
        public String path() { return "sample/" + "v1"; }
        public Alarmings alarmings = new Alarmings();
        public class Alarmings extends Path {
            public static final String PATH = "sample/v1/alarmings";
            private Alarmings(){}
            public String path() { return V1.this.path() + "/" + "alarmings"; }
            public Uuid uuid(String uuid){ return new Uuid(uuid); }
            public class Uuid {
                public static final String PATH = "sample/v1/alarmings/{uuid}";
                private final String value;
                private Uuid(String uuid){ this.value = uuid; }
                private String path() { return Alarmings.this.path() + "/" + value; }
                public Cancel cancel = new Cancel();
                public class Cancel {
                    public static final String PATH = "sample/v1/alarmings/{uuid}/cancel";
                    private Cancel(){}
                    private String path() { return Uuid.this.path() + "/" + "cancel"; }
                    public ReqUest reqUest = new ReqUest();
                    public class ReqUest extends Path {
                        public static final String PATH = "sample/v1/alarmings/{uuid}/cancel/req-._uest";
                        private ReqUest(){}
                        public String path() { return Cancel.this.path() + "/" + "req-._uest"; }
                    }
                }
                public Status status = new Status();
                public class Status extends Path {
                    public static final String PATH = "sample/v1/alarmings/{uuid}/status";
                    private Status(){}
                    public String path() { return Uuid.this.path() + "/" + "status"; }
                }
            }
        }
        public Antrittscheck antrittscheck = new Antrittscheck();
        public class Antrittscheck {
            public static final String PATH = "sample/v1/antrittscheck";
            private Antrittscheck(){}
            private String path() { return V1.this.path() + "/" + "antrittscheck"; }
            public Alarmings alarmings = new Alarmings();
            public class Alarmings {
                public static final String PATH = "sample/v1/antrittscheck/alarmings";
                private Alarmings(){}
                private String path() { return Antrittscheck.this.path() + "/" + "alarmings"; }
                public Uuid uuid(String uuid){ return new Uuid(uuid); }
                public class Uuid {
                    public static final String PATH = "sample/v1/antrittscheck/alarmings/{uuid}";
                    private final String value;
                    private Uuid(String uuid){ this.value = uuid; }
                    private String path() { return Alarmings.this.path() + "/" + value; }
                    public Context context = new Context();
                    public class Context extends Path {
                        public static final String PATH = "sample/v1/antrittscheck/alarmings/{uuid}/context";
                        private Context(){}
                        public String path() { return Uuid.this.path() + "/" + "context"; }
                    }
                }
            }
        }
        public Users users = new Users();
        public class Users extends Path {
            public static final String PATH = "sample/v1/users";
            private Users(){}
            public String path() { return V1.this.path() + "/" + "users"; }
            public Id id(int id){ return new Id(id); }
            public class Id extends Path {
                public static final String PATH = "sample/v1/users/{id}";
                private final int value;
                private Id(int id){ this.value = id; }
                public String path() { return Users.this.path() + "/" + value; }
            }
        }
    }
}