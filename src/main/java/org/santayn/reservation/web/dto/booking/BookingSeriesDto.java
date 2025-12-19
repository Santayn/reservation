package org.santayn.reservation.web.dto.booking;

import org.santayn.reservation.models.booking.BookingSeries;

import java.time.OffsetDateTime;

public record BookingSeriesDto(
        Long id,
        Long classroomId,
        Long groupId,
        String timezone,
        Integer floor,
        Integer dayOfWeek,
        BookingSeries.ScheduleType scheduleType,
        BookingSeries.WeekType weekType,
        OffsetDateTime createdAt
) {}
