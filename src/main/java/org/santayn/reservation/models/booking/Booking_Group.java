package org.santayn.reservation.models.booking;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "booking_group",
        uniqueConstraints = @UniqueConstraint(name = "ux_booking_group", columnNames = {"booking_id", "group_id"}),
        indexes = {
                @Index(name = "ix_bg_booking", columnList = "booking_id"),
                @Index(name = "ix_bg_group", columnList = "group_id")
        }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking_Group {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ссылка на бронь
    @Column(name = "booking_id", nullable = false)
    private Long bookingId;

    // ссылка на группу
    @Column(name = "group_id", nullable = false)
    private Integer groupId;
}
