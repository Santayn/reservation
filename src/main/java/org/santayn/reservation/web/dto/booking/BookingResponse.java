package org.santayn.reservation.web.dto.booking;

import java.time.DayOfWeek;
import org.santayn.reservation.models.schedule.WeekParityType;

/** Ответ по Booking. */
public class BookingResponse {

    private Long id;
    private DayOfWeek dayOfWeek;
    private Integer floor;
    private WeekParityType weekParityType;
    private Long slotId;
    private Long classroomId;
    private Long groupId;

    public BookingResponse() {}

    public BookingResponse(Long id, DayOfWeek dayOfWeek, Integer floor,
                           WeekParityType weekParityType, Long slotId,
                           Long classroomId, Long groupId) {
        this.id = id;
        this.dayOfWeek = dayOfWeek;
        this.floor = floor;
        this.weekParityType = weekParityType;
        this.slotId = slotId;
        this.classroomId = classroomId;
        this.groupId = groupId;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public DayOfWeek getDayOfWeek() { return dayOfWeek; }
    public void setDayOfWeek(DayOfWeek dayOfWeek) { this.dayOfWeek = dayOfWeek; }

    public Integer getFloor() { return floor; }
    public void setFloor(Integer floor) { this.floor = floor; }

    public WeekParityType getWeekParityType() { return weekParityType; }
    public void setWeekParityType(WeekParityType weekParityType) { this.weekParityType = weekParityType; }

    public Long getSlotId() { return slotId; }
    public void setSlotId(Long slotId) { this.slotId = slotId; }

    public Long getClassroomId() { return classroomId; }
    public void setClassroomId(Long classroomId) { this.classroomId = classroomId; }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }
}
