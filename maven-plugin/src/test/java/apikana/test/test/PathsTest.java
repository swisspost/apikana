package apikana.test.test;

import apikana.test.SampleApi;
import org.junit.Ignore;
import org.junit.Test;

import static apikana.test.SampleApi.v1;
import static org.junit.Assert.assertEquals;

/**
 * Created by niederhauste on 19.01.2017.
 */
public class PathsTest {
    @Test
    public void simple() {
//        assertEquals("/communication/alarming/v1/alarmings", v1.alarmings.path());
//        assertEquals("http://base/communication/alarming/v1/alarmings", v1.alarmings.url());
//        assertEquals("https://hula/communication/alarming/v1/alarmings", v1.alarmings.url("https://hula"));
//        assertEquals("/communication/alarming/v1/alarmings/bla/cancel/request", v1.alarmings.uuid("bla").cancel.reqUest.path());
//        assertEquals("http://base/communication/alarming/v1/alarmings/bla/cancel/request", v1.alarmings.uuid("bla").cancel.reqUest.url());
//        assertEquals("/communication/alarming/v1/alarmings/bla/status", v1.alarmings.uuid("bla").status.path());
//        assertEquals("http://base/communication/alarming/v1/alarmings/bla/status", v1.alarmings.uuid("bla").status.url());

//        Paths.alarming.v1.alarmings.path();
//        Paths.v1.users.path();
//        Paths.v1.users.id(42).path();
    }

    @Ignore(SampleApi.V1.PATH)
    public void useInAnnotation1() {
    }

    @Ignore(SampleApi.V1.Alarmings.PATH)
    public void useInAnnotation2() {
    }

    @Ignore(SampleApi.V1.Alarmings.Uuid.PATH)
    public void useInAnnotation3() {
    }

    @Ignore(SampleApi.V1.Alarmings.Uuid.Cancel.PATH)
    public void useInAnnotation4() {
    }

    @Ignore(SampleApi.V1.Alarmings.Uuid.Cancel.ReqUest.PATH)
    public void useInAnnotation5() {
    }
}
