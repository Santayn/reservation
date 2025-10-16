package org.santayn.reservation.web.dto.schedule;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleSlotResponse {
    private Long id;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
}

