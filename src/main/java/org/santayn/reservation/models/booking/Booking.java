package org.santayn.reservation.models.booking;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.classroom.Classroom;
import org.santayn.reservation.models.group.Group;

import org.santayn.reservation.models.schedule.ScheduleSlot;
import org.santayn.reservation.models.user.User;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "bookings",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_booking_date_slot_room",
                        columnNames = {"booking_date", "slot_id", "classroom_id"})
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Дата брони (для «короткой» брони). */
    @Column(name = "booking_date", nullable = false)
    private LocalDate date;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "slot_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_booking_slot"))
    private ScheduleSlot slot;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "classroom_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_booking_room"))
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id", foreignKey = @ForeignKey(name = "fk_booking_created_by"))
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /** Группы, забронировавшие аудиторию. */
    @ManyToMany
    @JoinTable(
            name = "booking_groups",
            joinColumns = @JoinColumn(name = "booking_id",
                    foreignKey = @ForeignKey(name = "fk_bg_booking")),
            inverseJoinColumns = @JoinColumn(name = "group_id",
                    foreignKey = @ForeignKey(name = "fk_bg_group"))
    )
    @Builder.Default
    private Set<Group> groups = new HashSet<>();
}
