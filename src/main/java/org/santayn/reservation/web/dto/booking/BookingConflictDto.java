package org.santayn.reservation.web.dto.booking;

import java.time.LocalDate;

/** Конфликт: дата + аудитория + слот уже заняты. */
public record BookingConflictDto(
        LocalDate date,
        Long slotId,
        Long classroomId,
        String reason
) {}
