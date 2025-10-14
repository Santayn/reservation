package org.santayn.reservation.repositories;

import org.santayn.reservation.models.booking.BookingSeries;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface BookingSeriesRepository extends JpaRepository<BookingSeries, Long>, JpaSpecificationExecutor<BookingSeries> {
}
