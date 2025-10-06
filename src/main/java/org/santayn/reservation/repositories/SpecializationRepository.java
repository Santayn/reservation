package org.santayn.reservation.repositories;

import org.santayn.reservation.models.specialization.Specialization;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SpecializationRepository extends JpaRepository<Specialization, Long> {
    Optional<Specialization> findByName(String name);
    boolean existsByName(String name);
}
