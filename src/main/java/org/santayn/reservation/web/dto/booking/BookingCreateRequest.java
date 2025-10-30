package org.santayn.reservation.web.dto.booking;

import jakarta.validation.constraints.NotNull;
import java.time.DayOfWeek;
import java.time.LocalDate;
import org.santayn.reservation.models.schedule.WeekParityType;

/**
 * Запрос на создание/обновление брони.
 *
 * Вариант 2:
 *  - Фронт НЕ передаёт classroomId (PK аудитории в БД).
 *  - Фронт передаёт только понятное пользователю имя аудитории (classroomName),
 *    например "Ауд. 101".
 *
 * Бэк самостоятельно найдёт реальный classroom.id через репозиторий аудиторий.
 */
public class BookingCreateRequest {

    @NotNull
    private DayOfWeek dayOfWeek;

    @NotNull
    private Integer floor;

    @NotNull
    private WeekParityType weekParityType;

    @NotNull
    private Long slotId;

    /**
     * Имя аудитории с фронта, напр. "Ауд. 101".
     * Это ключ для поиска аудитории в таблице classrooms.
     */
    @NotNull
    private String classroomName;

    @NotNull
    private Long groupId;

    /**
     * В обычном режиме (не админ) это поле на бэке будет принудительно заменено
     * на текущего преподавателя. Админу можно руками указать teacherId.
     */
    @NotNull
    private Long teacherId;

    /**
     * Для разовой брони преподавателя.
     * Если это не разовая бронь (админ создаёт постоянную),
     * то может быть null.
     */
    private LocalDate date;

    /**
     * Смещение временной зоны в текстовом виде.
     * Например: "UTC+03:00" или "Europe/Moscow".
     * Нужно, чтобы правильно высчитать expiresAt.
     */
    private String timeZoneId;

    public BookingCreateRequest() {
    }

    public BookingCreateRequest(
            DayOfWeek dayOfWeek,
            Integer floor,
            WeekParityType weekParityType,
            Long slotId,
            String classroomName,
            Long groupId,
            Long teacherId,
            LocalDate date,
            String timeZoneId
    ) {
        this.dayOfWeek = dayOfWeek;
        this.floor = floor;
        this.weekParityType = weekParityType;
        this.slotId = slotId;
        this.classroomName = classroomName;
        this.groupId = groupId;
        this.teacherId = teacherId;
        this.date = date;
        this.timeZoneId = timeZoneId;
    }

    public DayOfWeek getDayOfWeek() {
        return dayOfWeek;
    }

    public Integer getFloor() {
        return floor;
    }

    public WeekParityType getWeekParityType() {
        return weekParityType;
    }

    public Long getSlotId() {
        return slotId;
    }

    public String getClassroomName() {
        return classroomName;
    }

    public Long getGroupId() {
        return groupId;
    }

    public Long getTeacherId() {
        return teacherId;
    }

    public LocalDate getDate() {
        return date;
    }

    public String getTimeZoneId() {
        return timeZoneId;
    }

    public void setDayOfWeek(DayOfWeek dayOfWeek) {
        this.dayOfWeek = dayOfWeek;
    }

    public void setFloor(Integer floor) {
        this.floor = floor;
    }

    public void setWeekParityType(WeekParityType weekParityType) {
        this.weekParityType = weekParityType;
    }

    public void setSlotId(Long slotId) {
        this.slotId = slotId;
    }

    public void setClassroomName(String classroomName) {
        this.classroomName = classroomName;
    }

    public void setGroupId(Long groupId) {
        this.groupId = groupId;
    }

    public void setTeacherId(Long teacherId) {
        this.teacherId = teacherId;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public void setTimeZoneId(String timeZoneId) {
        this.timeZoneId = timeZoneId;
    }
}
