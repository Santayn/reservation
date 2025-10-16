package org.santayn.reservation.models.booking;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.DayOfWeek;

/**
 * Упрощённая сущность Booking.
 * Поля:
 * 1) id
 * 2) dayOfWeek        — день недели
 * 3) floor            — этаж
 * 4) weekParityType   — тип недели: чётная / нечётная / обычная
 * 5) timeZoneId       — идентификатор таймзоны (например, "Europe/Berlin")
 * 6) classroomId      — идентификатор аудитории
 * 7) groupId          — идентификатор группы
 */
@Entity
@Table(
        name = "bookings",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_booking_classroom_day_parity_group",
                        columnNames = {"day_of_week", "week_parity_type", "classroom_id", "group_id"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 2) День недели. */
    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, length = 16)
    private DayOfWeek dayOfWeek;

    /** 3) Этаж. */
    @Column(name = "floor", nullable = false)
    private Integer floor;

    /** 4) Тип недели: чётная, нечётная или обычная (без различия чётности). */
    @Enumerated(EnumType.STRING)
    @Column(name = "week_parity_type", nullable = false, length = 8)
    private org.santayn.reservation.models.schedule.WeekParityType weekParityType;

    /** 5) Таймзона (строковый идентификатор ZoneId). */
    @Column(name = "time_zone_id", nullable = false, length = 64)
    private String timeZoneId;

    /** 6) ID аудитории. */
    @Column(name = "classroom_id", nullable = false)
    private Long classroomId;

    /** 7) ID группы. */
    @Column(name = "group_id", nullable = false)
    private Long groupId;
}
