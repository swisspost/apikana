package apikana.test;

public class Paths2 {
    private static final String BASE_URL = "http://base";

    interface Path {
        String path();

        default String url() {
            return BASE_URL + path();
        }

        default String url(String base) {
            return base + path();
        }
    }

    public static Alarmings alarmings = new Alarmings();

    public static class Alarmings implements Path {
        private Alarmings() {
        }

        public Uuid uuid(String uuid) {
            return new Uuid(uuid);
        }

        public String path() {
            return "/communication/alarming/v1/alarmings";
        }

        public class Uuid {
            private final String value;
            public Status status = new Status();
            public Cancel cancel = new Cancel();

            private Uuid(String value) {
                this.value = value;
            }

            private String path() {
                return Alarmings.this.path() + "/" + value;
            }

            public final class Cancel {
                public Request request = new Request();

                private Cancel() {
                }

                private String path() {
                    return Uuid.this.path() + "/cancel";
                }

                public final class Request implements Path {
                    private Request() {
                    }

                    public String path() {
                        return Cancel.this.path() + "/request";
                    }
                }
            }

            public final class Status implements Path {
                private Status() {
                }

                public String path() {
                    return Uuid.this.path() + "/status";
                }
            }

        }
    }
}