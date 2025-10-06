package org.santayn.reservation.web.dto.booking;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

// src/main/java/org/santayn/reservation/web/dto/booking/BookingCreateRequest.java
public record BookingCreateRequest(
        @NotNull @JsonFormat(pattern = "yyyy-MM-dd") LocalDate date,
        @NotNull Long slotId,
        @NotNull Long classroomId,
        @NotEmpty List<Long> groupIds   // <-- было List<Integer>
) {}
