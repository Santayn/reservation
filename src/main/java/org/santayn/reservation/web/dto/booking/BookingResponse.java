package org.santayn.reservation.web.dto.booking;

import java.time.DayOfWeek;
import org.santayn.reservation.models.schedule.WeekParityType;

public class BookingResponse {

    private Long id;
    private DayOfWeek dayOfWeek;
    private Integer floor;
    private WeekParityType weekParityType;
    private String timeZoneId;
    private Long classroomId;
    private Long groupId;

    public BookingResponse() {
    }

    public BookingResponse(
            Long id,
            DayOfWeek dayOfWeek,
            Integer floor,
            WeekParityType weekParityType,
            String timeZoneId,
            Long classroomId,
            Long groupId
    ) {
        this.id = id;
        this.dayOfWeek = dayOfWeek;
        this.floor = floor;
        this.weekParityType = weekParityType;
        this.timeZoneId = timeZoneId;
        this.classroomId = classroomId;
        this.groupId = groupId;
    }

    public Long getId() { return id; }
    public DayOfWeek getDayOfWeek() { return dayOfWeek; }
    public Integer getFloor() { return floor; }
    public WeekParityType getWeekParityType() { return weekParityType; }
    public String getTimeZoneId() { return timeZoneId; }
    public Long getClassroomId() { return classroomId; }
    public Long getGroupId() { return groupId; }

    public void setId(Long id) { this.id = id; }
    public void setDayOfWeek(DayOfWeek dayOfWeek) { this.dayOfWeek = dayOfWeek; }
    public void setFloor(Integer floor) { this.floor = floor; }
    public void setWeekParityType(WeekParityType weekParityType) { this.weekParityType = weekParityType; }
    public void setTimeZoneId(String timeZoneId) { this.timeZoneId = timeZoneId; }
    public void setClassroomId(Long classroomId) { this.classroomId = classroomId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }
}
