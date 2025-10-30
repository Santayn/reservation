package org.santayn.reservation.repositories;


import org.santayn.reservation.layout.BuildingLayout;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BuildingLayoutRepository extends JpaRepository<BuildingLayout, Long> {

    List<BuildingLayout> findAllByBuildingIdOrderByNameAsc(Long buildingId);
}
