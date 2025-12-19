package org.santayn.reservation.repositories;

import java.util.List;
import java.util.Optional;
import org.santayn.reservation.layout.BuildingLayoutLink;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BuildingLayoutLinkRepository extends JpaRepository<BuildingLayoutLink, Long> {

    // найти линк конкретного здания и этажа
    Optional<BuildingLayoutLink> findByBuilding_IdAndFloorNumber(Long buildingId, Integer floorNumber);

    // все этажи одного здания, отсортировать по floor_number
    List<BuildingLayoutLink> findAllByBuilding_IdOrderByFloorNumberAsc(Long buildingId);

    // найти хоть один линк по layout_id (например, когда нужно узнать "а к какому зданию относится эта схема")
    Optional<BuildingLayoutLink> findFirstByLayout_IdOrderByFloorNumberAsc(Long layoutId);
    
    List<BuildingLayoutLink> findAllByLayout_Id(Long layoutId);
}

