package org.santayn.reservation.web.dto.lesson;// src/main/java/org/santayn/reservation/api/dto/LessonDto.java


import lombok.*;
import org.santayn.reservation.models.schedule.WeekParityType;

import java.time.DayOfWeek;


@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LessonDto {
    private Long bookingId;
    private DayOfWeek dayOfWeek;
    private WeekParityType weekParityType;
    private Long slotId;
    private Long classroomId;
    private Long groupId;
    private String groupName; // опционально (если есть имя группы)
}
