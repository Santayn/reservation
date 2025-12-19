package org.santayn.reservation.web.dto.building;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Плоский DTO корпуса.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BuildingDto {
    private Long id;
    private String name;
}
