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
import java.time.DayOfWeek;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.santayn.reservation.models.schedule.WeekParityType;

/**
 * Упрощённая сущность Booking, где "таймзона" заменена на slotId (временной интервал из расписания).
 *
 * Поля:
 * 1) id
 * 2) dayOfWeek       — день недели
 * 3) floor           — этаж
 * 4) weekParityType  — тип недели (EVEN/ODD/ANY)
 * 5) slotId          — идентификатор слота расписания (start_at / end_at в таблице слотов)
 * 6) classroomId     — идентификатор аудитории
 * 7) groupId         — идентификатор группы
 * 8) teacherId       — идентификатор преподавателя (опционально)
 */
@Entity
@Table(
        name = "bookings",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_booking_day_parity_room_slot_group",
                        columnNames = {"day_of_week", "week_parity_type", "classroom_id", "slot_id", "group_id"}
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

    /** День недели. */
    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, length = 16)
    private DayOfWeek dayOfWeek;

    /** Этаж. */
    @Column(name = "floor", nullable = false)
    private Integer floor;

    /** Тип недели: чётная, нечётная или обычная. */
    @Enumerated(EnumType.STRING)
    @Column(name = "week_parity_type", nullable = false, length = 8)
    private WeekParityType weekParityType;

    /** Слот расписания (интервал времени). */
    @Column(name = "slot_id", nullable = false)
    private Long slotId;

    /** ID аудитории. */
    @Column(name = "classroom_id", nullable = false)
    private Long classroomId;

    /** ID группы. */
    @Column(name = "group_id", nullable = false)
    private Long groupId;

    /** ID преподавателя (опционально; выбирается по имени на UI, сохраняем его id). */
    @Column(name = "teacher_id")
    private Long teacherId;

    /** Кто создал бронь (любой пользователь). */
    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    /** Признак, что бронь создана админом (препод не может менять/удалять). */
    @Column(name = "created_by_admin", nullable = false)
    private boolean createdByAdmin;

    /** Конкретная дата разовой брони (для «вечных» админских расписаний null). */
    @Column(name = "booking_date")
    private java.time.LocalDate bookingDate;

    /** Время окончания слота (UTC) — по нему чистим разовые брони преподов. */
    @Column(name = "expires_at")
    private java.time.Instant expiresAt;
}
