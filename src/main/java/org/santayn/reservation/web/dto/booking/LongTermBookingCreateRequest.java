package org.santayn.reservation.web.dto.booking;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

import org.santayn.reservation.models.booking.BookingKind;

/**
 * Создать серию броней по чётности недели и дню.
 */
public record LongTermBookingCreateRequest(
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,

        @NotNull DayOfWeek day,                 // java.time.DayOfWeek
        @NotNull WeekParity parity,             // ODD/EVEN/ALL

        @NotNull Long slotId,                   // ScheduleSlot.id
        @NotNull Long classroomId,              // Classroom.id
        List<Long> groupIds,                    // optional

        @NotNull BookingKind kind,              // тип брони
        @Size(max = 255) String title,
        @Size(max = 2000) String note
) {}
