package org.santayn.reservation.repositories;

import org.santayn.reservation.models.building.Building;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BuildingRepository extends JpaRepository<Building, Long> {
    Optional<Building> findByName(String name);
}
