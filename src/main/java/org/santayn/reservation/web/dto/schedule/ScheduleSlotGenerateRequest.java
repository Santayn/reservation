package org.santayn.reservation.web.dto.schedule;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;


/** Генерация сетки: первая пара + длительность пары и перемены. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleSlotGenerateRequest {
    /** Базовая дата для LocalDateTime; по умолчанию 1970-01-01. */
    @Builder.Default private LocalDate baseDate = LocalDate.of(1970, 1, 1);

    /** Время начала первой пары, например 08:00. */
    @NotNull private LocalTime firstStart;

    /** Сколько пар сгенерировать. */
    @Min(1) private int count;

    /** Длительность пары (мин). */
    @Min(1) private int lessonMinutes;

    /** Длительность перемены (мин) между парами. */
    @Min(0) private int breakMinutes;
}
