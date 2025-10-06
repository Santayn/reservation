package org.santayn.reservation.models.specialization;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "specializations", uniqueConstraints = {
        @UniqueConstraint(name = "uq_specialization_name", columnNames = {"name"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Specialization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Название специализации
    @Column(name = "name", nullable = false, length = 255)
    private String name;
}
