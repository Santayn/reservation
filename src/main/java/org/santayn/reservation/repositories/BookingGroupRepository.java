package org.santayn.reservation.repositories;

import org.santayn.reservation.models.booking.Booking_Group;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingGroupRepository extends JpaRepository<Booking_Group, Long> {

}
