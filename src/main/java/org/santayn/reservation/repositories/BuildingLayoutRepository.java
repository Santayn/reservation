package org.santayn.reservation.repositories;

import org.santayn.reservation.layout.BuildingLayout;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BuildingLayoutRepository extends JpaRepository<BuildingLayout, Long> {

    /**
     * Старый метод: получить схемы по buildingId (корпусу), отсортированные по имени.
     * Можно оставить для обратной совместимости.
     */
    List<BuildingLayout> findAllByBuildingIdOrderByNameAsc(Long buildingId);

    /**
     * Новый метод: получить абсолютно все схемы в системе,
     * отсортированные по возрастанию id.
     * Это то, что будет использовать фронт.
     */
    List<BuildingLayout> findAllByOrderByIdAsc();
}
