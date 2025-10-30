package org.santayn.reservation.layout;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "layout_defs") // ВАЖНО: это НЕ "building_layouts"
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BuildingLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Человеко-читаемое название схемы/этажа */
    @Column(name = "name", nullable = false, length = 255)
    private String name;

    /** Сырый JSON плана (elements и т.д.) */
    @Lob
    @Column(name = "layout_json", nullable = false, columnDefinition = "TEXT")
    private String layoutJson;

    /** Когда создано */
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** Когда последний раз изменено */
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
