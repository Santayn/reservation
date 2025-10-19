package org.santayn.reservation.web.dto.booking;

import java.time.DayOfWeek;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.santayn.reservation.models.schedule.WeekParityType;

/**
 * Ответ по брони.
 * Содержит teacherId (если был выбран на UI), чтобы фронт мог отобразить связанного преподавателя.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class BookingResponse {

    private Long id;
    private DayOfWeek dayOfWeek;
    private Integer floor;
    private WeekParityType weekParityType;
    private Long slotId;
    private Long classroomId;
    private Long groupId;

    /** ID преподавателя (может быть null). */
    private Long teacherId;
}
