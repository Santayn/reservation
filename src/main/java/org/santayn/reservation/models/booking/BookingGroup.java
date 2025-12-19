package org.santayn.reservation.models.booking;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.group.Group;

@Entity
@Table(name = "booking_groups", uniqueConstraints = {
        @UniqueConstraint(name = "uq_booking_group", columnNames = {"booking_id", "group_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingGroup {

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Id implements java.io.Serializable {
        @Column(name = "booking_id")
        private Long bookingId;
        @Column(name = "group_id")
        private Long groupId;
    }

    @EmbeddedId
    private Id id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("bookingId")
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("groupId")
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;
}
