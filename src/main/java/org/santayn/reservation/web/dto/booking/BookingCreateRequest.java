package org.santayn.reservation.web.dto.booking;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.DayOfWeek;
import java.time.LocalDate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.santayn.reservation.models.schedule.WeekParityType;

/**
 * Запрос на создание/обновление брони.
 * Добавлено поле teacherId для привязки к преподавателю, выбранному по имени на фронте.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingCreateRequest {

    @NotNull
    private DayOfWeek dayOfWeek;

    @NotNull
    @Min(0)
    private Integer floor;

    @NotNull
    private WeekParityType weekParityType;

    @NotNull
    private Long slotId;

    @NotNull
    private Long classroomId;

    @NotNull
    private Long groupId;

    /** ID преподавателя (опционально — можно не указывать). */
    private Long teacherId;

    private LocalDate date;

    private String timeZoneId;
}
