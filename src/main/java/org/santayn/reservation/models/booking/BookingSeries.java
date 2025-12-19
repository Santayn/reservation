package org.santayn.reservation.models.booking;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.classroom.Classroom;
import org.santayn.reservation.models.group.Group;

import java.time.OffsetDateTime;

@Entity
@Table(
        name = "booking_series",
        indexes = {
                @Index(name = "idx_bs_classroom_day", columnList = "classroom_id, day_of_week"),
                @Index(name = "idx_bs_group_day", columnList = "group_id, day_of_week"),
                @Index(name = "idx_bs_floor_day", columnList = "floor, day_of_week"),
                @Index(name = "idx_bs_mode_week", columnList = "schedule_type, week_type")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingSeries {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Аудитория (обязательна). */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    /** Группа (обязательна). */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    /** Тайм-зона, например Europe/Vienna. */
    @Column(name = "timezone", nullable = false, length = 64)
    private String timezone;

    /** Этаж (денормализация для быстрых фильтров). */
    @Column(name = "floor", nullable = false)
    private Integer floor;

    /** День недели ISO: 1=Пн … 7=Вс. */
    @Column(name = "day_of_week", nullable = false)
    private Integer dayOfWeek;

    /** Тип расписания: WEEKLY (каждую неделю) или PARITY (по чётности). */
    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_type", nullable = false, length = 16)
    private ScheduleType scheduleType;

    /** Тип недели: STABLE, EVEN, ODD. */
    @Enumerated(EnumType.STRING)
    @Column(name = "week_type", nullable = false, length = 8)
    private WeekType weekType;

    /** Время создания записи. */
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (timezone == null || timezone.isBlank()) timezone = "UTC";
        // Нормализация согласованности scheduleType/weekType:
        if (scheduleType == ScheduleType.WEEKLY) {
            weekType = WeekType.STABLE;
        } else if (scheduleType == ScheduleType.PARITY && (weekType == null || weekType == WeekType.STABLE)) {
            weekType = WeekType.EVEN; // дефолт при парности
        }
    }

    public enum ScheduleType { WEEKLY, PARITY }

    public enum WeekType { STABLE, EVEN, ODD }
}
