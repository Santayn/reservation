package org.santayn.reservation.web.dto.booking;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

// src/main/java/org/santayn/reservation/web/dto/booking/BookingCreateRequest.java
// org.santayn.reservation.web.dto.booking.BookingCreateRequest
public record BookingCreateRequest(
        LocalDate date,
        Long slotId,
        Long classroomId,
        List<Long> groupIds,

        // НОВОЕ — необязательные
        String scheduleMode,        // "WEEKLY" | "PARITY"
        String scheduleWeekParity,  // "EVEN" | "ODD" | null
        Integer scheduleDayOfWeek   // 1..7
) {}
