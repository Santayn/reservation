package org.santayn.reservation.repositories;

import org.santayn.reservation.models.booking.Booking;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingRepository extends JpaRepository<Booking, Long> { }
