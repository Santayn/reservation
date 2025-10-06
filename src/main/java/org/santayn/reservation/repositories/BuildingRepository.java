package org.santayn.reservation.repositories;

import java.util.Optional;
import org.santayn.reservation.models.building.Building;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BuildingRepository extends JpaRepository<Building, Long> {

    /**
     * Проверяет существование корпуса с именем без учёта регистра.
     */
    boolean existsByNameIgnoreCase(String name);

    /**
     * Находит корпус по имени без учёта регистра.
     */
    Optional<Building> findByNameIgnoreCase(String name);
}
