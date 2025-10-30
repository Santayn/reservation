package org.santayn.reservation.layout;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.building.Building;

/**
 * Связка "какое здание / какой этаж рисуется какой схемой".
 */
@Entity
@Table(
        name = "building_layouts",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_building_floor",
                        columnNames = {"building_id", "floor_number"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BuildingLayoutLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Какому зданию принадлежит этот этаж */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "building_id", nullable = false)
    private Building building;

    /** Какая схема (layout_defs.id) отрисовывает этот этаж */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "layout_id", nullable = false)
    private BuildingLayout layout;

    /** Номер этажа (1, 2, 3...) */
    @Column(name = "floor_number", nullable = false)
    private Integer floorNumber;
}
