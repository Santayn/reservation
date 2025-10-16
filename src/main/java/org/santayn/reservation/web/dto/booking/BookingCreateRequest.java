package org.santayn.reservation.web.dto.booking;

import java.time.DayOfWeek;
import org.santayn.reservation.models.schedule.WeekParityType;

/**
 * Запрос на создание/обновление упрощённого Booking.
 */
public class BookingCreateRequest {

    private DayOfWeek dayOfWeek;
    private Integer floor;
    private WeekParityType weekParityType;
    private String timeZoneId;
    private Long classroomId;
    private Long groupId;

    public BookingCreateRequest() {
    }

    public DayOfWeek getDayOfWeek() {
        return dayOfWeek;
    }

    public void setDayOfWeek(DayOfWeek dayOfWeek) {
        this.dayOfWeek = dayOfWeek;
    }

    public Integer getFloor() {
        return floor;
    }

    public void setFloor(Integer floor) {
        this.floor = floor;
    }

    public WeekParityType getWeekParityType() {
        return weekParityType;
    }

    public void setWeekParityType(WeekParityType weekParityType) {
        this.weekParityType = weekParityType;
    }

    public String getTimeZoneId() {
        return timeZoneId;
    }

    public void setTimeZoneId(String timeZoneId) {
        this.timeZoneId = timeZoneId;
    }

    public Long getClassroomId() {
        return classroomId;
    }

    public void setClassroomId(Long classroomId) {
        this.classroomId = classroomId;
    }

    public Long getGroupId() {
        return groupId;
    }

    public void setGroupId(Long groupId) {
        this.groupId = groupId;
    }
}
