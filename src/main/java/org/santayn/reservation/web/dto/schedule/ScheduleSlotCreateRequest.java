package org.santayn.reservation.web.dto.schedule;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;


@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleSlotCreateRequest {
    /** Например: 1970-01-01T08:00:00 */
    @NotNull private LocalDateTime startAt;
    /** Например: 1970-01-01T09:30:00 */
    @NotNull private LocalDateTime endAt;
}

