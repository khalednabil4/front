class Center(SoftDeleteModel):
    name = models.CharField(max_length=100)
    province = models.ForeignKey(
        "core.Province",
        on_delete=models.CASCADE,
        related_name="province_centers",
        null=True,
        blank=True,
    )
    slug = models.SlugField(null=True, blank=True)
    map_color = models.CharField(max_length=20, default="#f8b4ad", blank=True)
    map_size = models.CharField(
        max_length=20,
        choices=CENTER_MAP_SIZE_CHOICES,
        default="medium",
    )
    map_position = models.JSONField(default=dict, blank=True)
    map_position_reference = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="positioned_centers",
        null=True,
        blank=True,
    )
    map_shape = models.JSONField(default=dict, blank=True)

    @classmethod
    def _bbox_for_center(cls, center):
        if not center:
            return {}
        normalized_shape = normalize_center_map_shape(
            getattr(center, "map_shape", {}),
            getattr(center, "map_size", "medium"),
        )
        if _center_map_shape_is_complete(normalized_shape):
            return normalized_shape["bbox"]

        normalized_position = _normalize_center_map_position(
            getattr(center, "map_position", {}),
            getattr(center, "map_position_reference_id", None),
        )
        if _center_map_position_is_complete(normalized_position):
            return _candidate_bbox(
                normalized_position["x"],
                normalized_position["y"],
                getattr(center, "map_size", "medium"),
                direction=normalized_position.get("direction"),
            )
        return {}

    def _reference_center(self):
        reference_center = getattr(self, "map_position_reference", None)
        if reference_center is None and self.map_position_reference_id:
            reference_center = self.__class__.objects.filter(pk=self.map_position_reference_id).first()
        return reference_center

    def _occupied_map_bboxes(self):
        occupied = []
        queryset = self.__class__.objects.exclude(pk=self.pk).only(
            "id",
            "map_shape",
            "map_position",
            "map_size",
            "map_position_reference",
        )
        for center in queryset:
            bbox = self._bbox_for_center(center)
            if bbox:
                occupied.append(bbox)
        return occupied

    def _generate_root_map_position(self, occupied_bboxes):
        size_width, size_height = _shape_dimensions_for_direction(self.map_size, direction="main")
        center_min_x = CENTER_MAP_BOUNDS["min_x"] + (size_width / 2)
        center_max_x = CENTER_MAP_BOUNDS["max_x"] - (size_width / 2)
        center_min_y = CENTER_MAP_BOUNDS["min_y"] + (size_height / 2)
        center_max_y = CENTER_MAP_BOUNDS["max_y"] - (size_height / 2)
        candidate_positions = list(CENTER_MAP_ROOT_SLOTS)
        candidate_positions.extend(
            [
                (680.0, 240.0),
                (690.0, 350.0),
                (640.0, 470.0),
                (560.0, 560.0),
            ]
        )
        best_candidate = None
        for slot_x, slot_y in candidate_positions:
            center_x, center_y, overflow = _clamp_candidate(
                min(max(slot_x, center_min_x), center_max_x),
                min(max(slot_y, center_min_y), center_max_y),
                self.map_size,
                direction="main",
            )
            bbox = _candidate_bbox(center_x, center_y, self.map_size, direction="main")
            offset = abs(center_y - (CENTER_MAP_CANVAS["height"] / 2.0)) + abs(center_x - 690.0)
            score = _candidate_score(bbox, occupied_bboxes, overflow=overflow, offset=offset)
            candidate = {
                "x": center_x,
                "y": center_y,
                "direction": "main",
                "reference_center_id": None,
                "score": score,
            }
            if best_candidate is None or candidate["score"] < best_candidate["score"]:
                best_candidate = candidate

        return {
            "x": best_candidate["x"],
            "y": best_candidate["y"],
            "direction": "main",
            "reference_center_id": None,
        }

    def _generate_relative_map_position(self, reference_center, requested_direction, occupied_bboxes):
        reference_bbox = self._bbox_for_center(reference_center)
        if not reference_bbox:
            return self._generate_root_map_position(occupied_bboxes)

        normalized_direction = _coerce_center_map_direction(requested_direction)
        if normalized_direction and normalized_direction not in {"auto", "main"}:
            directions = (normalized_direction,)
        else:
            directions = list(CENTER_MAP_DIRECTION_PRIORITY)
            random.shuffle(directions)
        reference_height = reference_bbox["maxY"] - reference_bbox["minY"]
        reference_width = reference_bbox["maxX"] - reference_bbox["minX"]
        offsets = (0.0, -16.0, 16.0, -32.0, 32.0, -48.0, 48.0)
        best_candidate = None

        for direction in directions:
            width, height = _shape_dimensions_for_direction(self.map_size, direction=direction)
            half_width = width / 2
            half_height = height / 2
            for offset in offsets:
                if direction == "left":
                    raw_x = reference_bbox["minX"] - CENTER_MAP_ATTACHMENT_GAP - half_width
                    raw_y = reference_bbox["centerY"] + offset
                elif direction == "right":
                    raw_x = reference_bbox["maxX"] + CENTER_MAP_ATTACHMENT_GAP + half_width
                    raw_y = reference_bbox["centerY"] + offset
                elif direction == "up":
                    raw_x = reference_bbox["centerX"] + offset
                    raw_y = reference_bbox["minY"] - CENTER_MAP_ATTACHMENT_GAP - half_height
                elif direction == "top-right":
                    raw_x = reference_bbox["maxX"] + CENTER_MAP_ATTACHMENT_GAP + half_width
                    raw_y = reference_bbox["minY"] + max(reference_height * 0.18, height * 0.22) + offset
                elif direction == "bottom-right":
                    raw_x = reference_bbox["maxX"] + CENTER_MAP_ATTACHMENT_GAP + half_width
                    raw_y = reference_bbox["maxY"] - max(reference_height * 0.18, height * 0.22) + offset
                elif direction == "top-left":
                    raw_x = reference_bbox["minX"] - CENTER_MAP_ATTACHMENT_GAP - half_width
                    raw_y = reference_bbox["minY"] + max(reference_height * 0.18, height * 0.22) + offset
                elif direction == "bottom-left":
                    raw_x = reference_bbox["minX"] - CENTER_MAP_ATTACHMENT_GAP - half_width
                    raw_y = reference_bbox["maxY"] - max(reference_height * 0.18, height * 0.22) + offset
                else:
                    raw_x = reference_bbox["centerX"] + offset
                    raw_y = reference_bbox["maxY"] + CENTER_MAP_ATTACHMENT_GAP + half_height

                center_x, center_y, overflow = _clamp_candidate(raw_x, raw_y, self.map_size, direction=direction)
                bbox = _candidate_bbox(center_x, center_y, self.map_size, direction=direction)
                spread_penalty = abs(center_x - (CENTER_MAP_CANVAS["width"] / 2.0)) * 0.12 + abs(center_y - (CENTER_MAP_CANVAS["height"] / 2.0)) * 0.08
                score = _candidate_score(bbox, occupied_bboxes, overflow=overflow, offset=abs(offset) + spread_penalty + (reference_width * 0.02))
                candidate = {
                    "x": center_x,
                    "y": center_y,
                    "direction": direction,
                    "reference_center_id": reference_center.id,
                    "score": score,
                }
                if best_candidate is None or candidate["score"] < best_candidate["score"]:
                    best_candidate = candidate

        if not best_candidate:
            return self._generate_root_map_position(occupied_bboxes)

        return {
            "x": best_candidate["x"],
            "y": best_candidate["y"],
            "direction": best_candidate["direction"],
            "reference_center_id": best_candidate["reference_center_id"],
        }

    def _generate_map_position(self, requested_direction=None):
        occupied_bboxes = self._occupied_map_bboxes()
        reference_center = self._reference_center()
        if reference_center is None:
            return self._generate_root_map_position(occupied_bboxes)
        return self._generate_relative_map_position(
            reference_center,
            requested_direction=requested_direction,
            occupied_bboxes=occupied_bboxes,
        )

    def _enriched_existing_map_shape(self, position_payload):
        normalized_shape = normalize_center_map_shape(self.map_shape, self.map_size)
        if not normalized_shape:
            return {}
        normalized_shape["attached_side"] = position_payload.get("direction") or normalized_shape.get("attached_side") or "right"
        normalized_shape["attached_to"] = position_payload.get("reference_center_id")
        normalized_shape["template"] = normalized_shape.get("template") or _center_map_template(
            self.map_size,
            normalized_shape["attached_side"],
        )
        normalized_shape["seed"] = normalized_shape.get("seed") or _shape_seed()
        return normalized_shape

    def _apply_map_generation(
        self,
        force_map_regeneration=False,
        regenerate_map_position=False,
        regenerate_map_shape=False,
    ):
        self.map_size = _normalize_center_map_size(self.map_size)
        if not self.slug and self.name:
            self.slug = slugify(self.name, allow_unicode=True)

        previous = None
        if self.pk:
            previous = self.__class__.all_objects.filter(pk=self.pk).only(
                "map_position",
                "map_shape",
                "map_size",
                "map_position_reference",
            ).first()

        previous_position = _normalize_center_map_position(
            getattr(previous, "map_position", {}),
            getattr(previous, "map_position_reference_id", None),
        )
        previous_shape = normalize_center_map_shape(
            getattr(previous, "map_shape", {}),
            getattr(previous, "map_size", self.map_size),
        )

        requested_direction = _coerce_center_map_direction(self.map_position)
        current_position = _normalize_center_map_position(
            self.map_position,
            self.map_position_reference_id,
        )
        current_shape = normalize_center_map_shape(self.map_shape, self.map_size)

        current_position_complete = _center_map_position_is_complete(current_position)
        current_shape_complete = _center_map_shape_is_complete(current_shape)
        previous_position_complete = _center_map_position_is_complete(previous_position)
        previous_shape_complete = _center_map_shape_is_complete(previous_shape)

        previous_direction = _coerce_center_map_direction(previous_position)
        reference_changed = bool(
            previous
            and self.map_position_reference_id != getattr(previous, "map_position_reference_id", None)
        )
        size_changed = bool(previous and self.map_size != getattr(previous, "map_size", self.map_size))
        direction_changed = bool(
            previous
            and requested_direction
            and requested_direction != previous_direction
            and not current_position_complete
        )

        if previous and previous_position_complete and not (
            force_map_regeneration
            or regenerate_map_position
            or reference_changed
            or size_changed
            or direction_changed
        ):
            if not current_position_complete:
                current_position = previous_position
                current_position_complete = True
            if not current_shape_complete and previous_shape_complete:
                current_shape = previous_shape
                current_shape_complete = True

        should_regenerate_position = (
            force_map_regeneration
            or regenerate_map_position
            or reference_changed
            or size_changed
            or direction_changed
            or not current_position_complete
        )

        if should_regenerate_position:
            current_position = self._generate_map_position(requested_direction=requested_direction)
        else:
            current_position["reference_center_id"] = self.map_position_reference_id

        should_regenerate_shape = (
            force_map_regeneration
            or regenerate_map_shape
            or should_regenerate_position
            or not current_shape_complete
        )

        if should_regenerate_shape:
            current_shape = generate_center_map_shape(
                size=self.map_size,
                center_x=current_position["x"],
                center_y=current_position["y"],
                direction=current_position["direction"],
                attached_to=current_position.get("reference_center_id"),
            )
        else:
            current_shape = self._enriched_existing_map_shape(current_position)

        self.map_position = current_position
        self.map_shape = current_shape

    def save(self, *args, **kwargs):
        force_map_regeneration = kwargs.pop("force_map_regeneration", False)
        regenerate_map_position = kwargs.pop("regenerate_map_position", False)
        regenerate_map_shape = kwargs.pop("regenerate_map_shape", False)
        self._apply_map_generation(
            force_map_regeneration=force_map_regeneration,
            regenerate_map_position=regenerate_map_position,
            regenerate_map_shape=regenerate_map_shape,
        )
        return super().save(*args, **kwargs)

    @classmethod
    def regenerate_map_layout(cls, centers, persist=True, weight_by_center=None, layout_attempt=0):
        centers = [center for center in centers if center is not None]
        if not centers:
            return []

        center_by_id = {center.id: center for center in centers if center.id is not None}
        weight_by_center = weight_by_center or {}
        size_rank = {"large": 0, "medium": 1, "small": 2}
        children_by_reference = defaultdict(list)
        roots = []

        for center in centers:
            center.map_size = _normalize_center_map_size(center.map_size)
            if center.name and not center.slug:
                center.slug = slugify(center.name, allow_unicode=True)
            if center.map_position_reference_id and center.map_position_reference_id in center_by_id:
                children_by_reference[center.map_position_reference_id].append(center)
            else:
                roots.append(center)

        def center_sort_key(center):
            area_weight = float(weight_by_center.get(center.id, _size_area_weight(center.map_size)))
            return (
                -area_weight,
                size_rank.get(_normalize_center_map_size(center.map_size), 1),
                (center.name or "").strip().lower(),
                center.id or 0,
            )

        ordered = []
        visited = set()

        def visit(center):
            if center.id in visited:
                return
            visited.add(center.id)
            ordered.append(center)
            for child in sorted(children_by_reference.get(center.id, []), key=center_sort_key):
                visit(child)

        for root in sorted(roots, key=center_sort_key):
            visit(root)
        for center in sorted(centers, key=center_sort_key):
            visit(center)

        placement_boundary = _center_map_outer_boundary()
        placement_center_x, placement_center_y = _polygon_centroid_tuples(placement_boundary)
        occupied_bboxes = []
        placed_meta = {}
        root_candidates = list(CENTER_MAP_ROOT_SLOTS) + [
            (640.0, 194.0),
            (668.0, 360.0),
            (610.0, 552.0),
            (500.0, 286.0),
            (472.0, 492.0),
        ]

        def attempt_jitter(center_id, *, scale=1.0):
            if layout_attempt <= 0:
                return (0.0, 0.0)
            phase = ((int(center_id or 0) * 17) + (layout_attempt * 11)) % 8
            base_magnitude = min(14.0, 3.0 + (layout_attempt * 1.7))
            offsets = (
                (0.0, 0.0),
                (base_magnitude, 0.0),
                (-base_magnitude, 0.0),
                (0.0, base_magnitude),
                (0.0, -base_magnitude),
                (base_magnitude * 0.72, base_magnitude * 0.48),
                (-base_magnitude * 0.72, base_magnitude * 0.48),
                (base_magnitude * 0.52, -base_magnitude * 0.64),
            )
            offset_x, offset_y = offsets[phase]
            return (offset_x * scale, offset_y * scale)

        def stable_seed(center):
            normalized_shape = normalize_center_map_shape(center.map_shape, center.map_size)
            existing_seed = normalized_shape.get("seed")
            if existing_seed:
                return int(existing_seed)
            base_id = int(center.id or len(occupied_bboxes) + 1)
            return 10000 + ((base_id * 7919) % 80000)

        def layout_weight(center):
            return float(weight_by_center.get(center.id, _size_area_weight(center.map_size)))

        def choose_root_position(center):
            best = None
            area_weight = layout_weight(center)
            root_shift = layout_attempt % max(1, len(root_candidates))
            ordered_root_candidates = root_candidates[root_shift:] + root_candidates[:root_shift]
            jitter_x, jitter_y = attempt_jitter(center.id, scale=0.86)
            for slot_x, slot_y in ordered_root_candidates:
                center_x, center_y, overflow = _clamp_candidate(
                    slot_x + jitter_x,
                    slot_y + jitter_y,
                    center.map_size,
                    direction="main",
                )
                center_x, center_y = _clamp_seed_to_boundary((center_x, center_y), placement_boundary)
                bbox = _candidate_bbox(center_x, center_y, center.map_size, direction="main")
                spacing_penalty = 0.0
                for occupied_bbox in occupied_bboxes:
                    occupied_center_x = occupied_bbox["centerX"]
                    occupied_center_y = occupied_bbox["centerY"]
                    distance = math.hypot(center_x - occupied_center_x, center_y - occupied_center_y)
                    desired_spacing = 164.0 + (area_weight * 10.0)
                    spacing_penalty += max(0.0, desired_spacing - distance) * 1.4
                    alignment_delta_x = abs(center_x - occupied_center_x)
                    if alignment_delta_x < 92.0:
                        spacing_penalty += (92.0 - alignment_delta_x) * 1.35
                centrality_penalty = (
                    abs(center_x - placement_center_x)
                    + abs(center_y - placement_center_y)
                ) * max(0.72, area_weight)
                score = _candidate_score(
                    bbox,
                    occupied_bboxes,
                    overflow=overflow,
                    offset=centrality_penalty + spacing_penalty,
                )
                candidate = {
                    "x": center_x,
                    "y": center_y,
                    "direction": "main",
                    "reference_center_id": None,
                    "score": score,
                }
                if best is None or candidate["score"] < best["score"]:
                    best = candidate
            return best

        def choose_anchor():
            if not placed_meta:
                return None
            return min(
                placed_meta.values(),
                key=lambda meta: (
                    meta["attachments"],
                    abs(meta["bbox"]["centerX"] - placement_center_x) + abs(meta["bbox"]["centerY"] - placement_center_y),
                    meta["center"].id or 0,
                ),
            )

        def choose_relative_position(center, anchor_meta, requested_direction):
            anchor_bbox = anchor_meta["bbox"]
            area_weight = layout_weight(center)
            directions = (
                [requested_direction]
                if requested_direction and requested_direction not in {"auto", "main"}
                else list(CENTER_MAP_DIRECTION_PRIORITY)
            )
            best = None
            anchor_height = anchor_bbox["maxY"] - anchor_bbox["minY"]
            anchor_width = anchor_bbox["maxX"] - anchor_bbox["minX"]
            attempt_offset = (layout_attempt % 4) * 6.0
            offsets = (
                0.0,
                -(18.0 + attempt_offset),
                18.0 + attempt_offset,
                -(34.0 + (attempt_offset * 0.85)),
                34.0 + (attempt_offset * 0.85),
                -(52.0 + (attempt_offset * 0.75)),
                52.0 + (attempt_offset * 0.75),
            )
            jitter_x, jitter_y = attempt_jitter(center.id, scale=0.62)

            for direction in directions:
                width, height = _shape_dimensions_for_direction(center.map_size, direction=direction)
                half_width = width / 2.0
                half_height = height / 2.0
                for offset in offsets:
                    if direction == "right":
                        raw_x = anchor_bbox["maxX"] + CENTER_MAP_ATTACHMENT_GAP + half_width
                        raw_y = anchor_bbox["centerY"] + offset
                    elif direction == "left":
                        raw_x = anchor_bbox["minX"] - CENTER_MAP_ATTACHMENT_GAP - half_width
                        raw_y = anchor_bbox["centerY"] + offset
                    elif direction == "up":
                        raw_x = anchor_bbox["centerX"] + offset
                        raw_y = anchor_bbox["minY"] - CENTER_MAP_ATTACHMENT_GAP - half_height
                    elif direction == "down":
                        raw_x = anchor_bbox["centerX"] + offset
                        raw_y = anchor_bbox["maxY"] + CENTER_MAP_ATTACHMENT_GAP + half_height
                    elif direction == "top-right":
                        raw_x = anchor_bbox["maxX"] + CENTER_MAP_ATTACHMENT_GAP + half_width
                        raw_y = anchor_bbox["minY"] + max(anchor_height * 0.18, height * 0.24) + offset
                    elif direction == "bottom-right":
                        raw_x = anchor_bbox["maxX"] + CENTER_MAP_ATTACHMENT_GAP + half_width
                        raw_y = anchor_bbox["maxY"] - max(anchor_height * 0.18, height * 0.24) + offset
                    elif direction == "top-left":
                        raw_x = anchor_bbox["minX"] - CENTER_MAP_ATTACHMENT_GAP - half_width
                        raw_y = anchor_bbox["minY"] + max(anchor_height * 0.18, height * 0.24) + offset
                    else:
                        raw_x = anchor_bbox["minX"] - CENTER_MAP_ATTACHMENT_GAP - half_width
                        raw_y = anchor_bbox["maxY"] - max(anchor_height * 0.18, height * 0.24) + offset

                    center_x, center_y, overflow = _clamp_candidate(
                        raw_x + jitter_x,
                        raw_y + jitter_y,
                        center.map_size,
                        direction=direction,
                    )
                    center_x, center_y = _clamp_seed_to_boundary((center_x, center_y), placement_boundary)
                    bbox = _candidate_bbox(center_x, center_y, center.map_size, direction=direction)
                    spread_penalty = (
                        abs(center_x - placement_center_x) * 0.11
                        + abs(center_y - placement_center_y) * 0.08
                    ) * max(0.68, area_weight * 0.92)
                    score = _candidate_score(
                        bbox,
                        occupied_bboxes,
                        overflow=overflow,
                        offset=abs(offset) + spread_penalty + (anchor_width * 0.02) + (anchor_meta["attachments"] * 18.0),
                    )
                    candidate = {
                        "x": center_x,
                        "y": center_y,
                        "direction": direction,
                        "reference_center_id": anchor_meta["center"].id,
                        "score": score,
                    }
                    if best is None or candidate["score"] < best["score"]:
                        best = candidate

            return best or choose_root_position(center)

        requested_directions = {}
        preferred_positions = []

        for center in ordered:
            requested_direction = _coerce_center_map_direction(center.map_position) or "auto"
            explicit_anchor_meta = placed_meta.get(center.map_position_reference_id)
            anchor_meta = explicit_anchor_meta

            if anchor_meta is None and placed_meta:
                anchor_meta = choose_anchor()

            if anchor_meta is None:
                position_payload = choose_root_position(center)
            else:
                position_payload = choose_relative_position(center, anchor_meta, requested_direction)

            center.map_position = {
                "x": position_payload["x"],
                "y": position_payload["y"],
                "direction": position_payload["direction"],
                "reference_center_id": position_payload.get("reference_center_id"),
            }
            requested_directions[center.id] = requested_direction
            preferred_positions.append((position_payload["x"], position_payload["y"]))

            placed_meta[center.id] = {
                "center": center,
                "bbox": _candidate_bbox(
                    position_payload["x"],
                    position_payload["y"],
                    center.map_size,
                    direction=position_payload["direction"],
                ),
                "attachments": 0,
            }
            occupied_bboxes.append(placed_meta[center.id]["bbox"])
            if anchor_meta:
                anchor_meta["attachments"] += 1

        boundary = _center_map_outer_boundary([meta["bbox"] for meta in placed_meta.values()])
        boundary_area = _polygon_area_tuples(boundary)
        boundary_center_x, boundary_center_y = _polygon_centroid_tuples(boundary)
        index_by_id = {center.id: index for index, center in enumerate(ordered)}
        seeds = []
        for index, center in enumerate(ordered):
            seed = _clamp_seed_to_boundary(preferred_positions[index], boundary)
            reference_index = index_by_id.get(center.map_position_reference_id)
            requested_direction = requested_directions.get(center.id)
            if reference_index is not None:
                reference_seed = tuple(seeds[reference_index]) if reference_index < len(seeds) else preferred_positions[reference_index]
                reference_center = ordered[reference_index]
                seed = _constrain_seed_to_reference_direction(
                    seed,
                    reference_seed,
                    requested_direction,
                    center.map_size,
                    reference_center.map_size,
                )
                seed = _clamp_seed_to_boundary(seed, boundary)
            seeds.append(list(seed))
        target_weight_total = sum(
            float(weight_by_center.get(center.id, _size_area_weight(center.map_size)))
            for center in ordered
        ) or 1.0
        target_areas = [
            boundary_area * (
                float(weight_by_center.get(center.id, _size_area_weight(center.map_size))) / target_weight_total
            )
            for center in ordered
        ]
        weights = []
        for center in ordered:
            base_area_weight = _size_area_weight(center.map_size)
            dynamic_bias = float(weight_by_center.get(center.id, base_area_weight)) - base_area_weight
            weights.append(
                max(
                    -CENTER_MAP_POWER_WEIGHT_LIMIT,
                    min(CENTER_MAP_POWER_WEIGHT_LIMIT, dynamic_bias * -2400.0),
                )
            )

        def infer_direction(center, seed):
            reference_id = center.map_position_reference_id
            requested_direction = requested_directions.get(center.id)
            if reference_id is None:
                return "main"
            if requested_direction and requested_direction not in {"auto", "main"}:
                return requested_direction
            reference_index = index_by_id.get(reference_id)
            if reference_index is None:
                return "main"
            reference_seed = seeds[reference_index]
            delta_x = seed[0] - reference_seed[0]
            delta_y = seed[1] - reference_seed[1]
            if abs(delta_x) >= abs(delta_y) * 1.6:
                return "right" if delta_x >= 0 else "left"
            if abs(delta_y) >= abs(delta_x) * 1.6:
                return "down" if delta_y >= 0 else "up"
            if delta_x >= 0 and delta_y <= 0:
                return "top-right"
            if delta_x >= 0 and delta_y > 0:
                return "bottom-right"
            if delta_x < 0 and delta_y <= 0:
                return "top-left"
            return "bottom-left"

        for _ in range(22):
            cells = [
                _compute_power_cell(boundary, index, seeds, weights)
                for index in range(len(ordered))
            ]

            for index, center in enumerate(ordered):
                cell = cells[index]
                preferred_x, preferred_y = preferred_positions[index]
                if len(cell) < 3:
                    seed_x = (seeds[index][0] * 0.48) + (preferred_x * 0.34) + (boundary_center_x * 0.18)
                    seed_y = (seeds[index][1] * 0.48) + (preferred_y * 0.34) + (boundary_center_y * 0.18)
                    reference_index = index_by_id.get(center.map_position_reference_id)
                    if reference_index is not None:
                        reference_center = ordered[reference_index]
                        seed_x, seed_y = _constrain_seed_to_reference_direction(
                            (seed_x, seed_y),
                            tuple(seeds[reference_index]),
                            requested_directions.get(center.id),
                            center.map_size,
                            reference_center.map_size,
                        )
                    seeds[index] = list(_clamp_seed_to_boundary((seed_x, seed_y), boundary))
                    weights[index] = max(
                        -CENTER_MAP_POWER_WEIGHT_LIMIT,
                        min(CENTER_MAP_POWER_WEIGHT_LIMIT, weights[index] * 0.86),
                    )
                    continue

                cell_area = _polygon_area_tuples(cell)
                if cell_area < 400.0:
                    weights[index] = max(
                        -CENTER_MAP_POWER_WEIGHT_LIMIT,
                        min(CENTER_MAP_POWER_WEIGHT_LIMIT, weights[index] - 120.0),
                    )
                    continue

                centroid_x, centroid_y = _polygon_centroid_tuples(cell)
                target_area = target_areas[index]
                normalized_size = _normalize_center_map_size(center.map_size)
                area_ratio = cell_area / max(target_area, 1.0)
                weight_delta = max(-260.0, min(260.0, (target_area - cell_area) * 0.0065))
                if normalized_size == "small" and area_ratio > 1.1:
                    weight_delta -= min(180.0, (area_ratio - 1.0) * 220.0)
                elif normalized_size == "large" and area_ratio < 0.96:
                    weight_delta += min(180.0, (1.0 - area_ratio) * 260.0)
                weights[index] = max(
                    -CENTER_MAP_POWER_WEIGHT_LIMIT,
                    min(CENTER_MAP_POWER_WEIGHT_LIMIT, weights[index] - weight_delta),
                )

                requested_direction = requested_directions.get(center.id)
                explicit_direction = requested_direction and requested_direction not in {"auto", "main"}
                inertia_weight = 0.2
                centroid_weight = 0.34 if explicit_direction else 0.46
                preferred_weight = 1.0 - inertia_weight - centroid_weight
                next_x = (seeds[index][0] * inertia_weight) + (centroid_x * centroid_weight) + (preferred_x * preferred_weight)
                next_y = (seeds[index][1] * inertia_weight) + (centroid_y * centroid_weight) + (preferred_y * preferred_weight)
                if center.map_position_reference_id in index_by_id:
                    reference_index = index_by_id[center.map_position_reference_id]
                    reference_seed = seeds[reference_index]
                    next_x = (next_x * 0.84) + (reference_seed[0] * 0.16)
                    next_y = (next_y * 0.84) + (reference_seed[1] * 0.16)
                    next_x, next_y = _constrain_seed_to_reference_direction(
                        (next_x, next_y),
                        tuple(reference_seed),
                        requested_direction,
                        center.map_size,
                        ordered[reference_index].map_size,
                    )
                seeds[index] = list(_clamp_seed_to_boundary((next_x, next_y), boundary))

            for left_index in range(len(ordered)):
                for right_index in range(left_index + 1, len(ordered)):
                    left_seed = seeds[left_index]
                    right_seed = seeds[right_index]
                    delta_x = right_seed[0] - left_seed[0]
                    delta_y = right_seed[1] - left_seed[1]
                    distance = math.hypot(delta_x, delta_y)
                    minimum_distance = (
                        _desired_seed_spacing(ordered[left_index].map_size)
                        + _desired_seed_spacing(ordered[right_index].map_size)
                    ) / 2.0
                    if distance >= minimum_distance:
                        continue
                    if distance < 1e-6:
                        angle = ((left_index + 1) * 37) % 360
                        delta_x = math.cos(math.radians(angle))
                        delta_y = math.sin(math.radians(angle))
                        distance = 1.0
                    push = (minimum_distance - distance) / 2.0
                    unit_x = delta_x / distance
                    unit_y = delta_y / distance
                    left_seed[0] -= unit_x * push
                    left_seed[1] -= unit_y * push
                    right_seed[0] += unit_x * push
                    right_seed[1] += unit_y * push
                    seeds[left_index] = list(_clamp_seed_to_boundary(left_seed, boundary))
                    seeds[right_index] = list(_clamp_seed_to_boundary(right_seed, boundary))

        final_cells = [
            _compute_power_cell(boundary, index, seeds, weights)
            for index in range(len(ordered))
        ]

        for _ in range(12):
            empty_indices = [index for index, cell in enumerate(final_cells) if len(cell) < 3]
            if not empty_indices or len(ordered) == 1:
                break

            for index in empty_indices:
                center = ordered[index]
                preferred_x, preferred_y = preferred_positions[index]
                requested_direction = requested_directions.get(center.id)
                next_x = (preferred_x * 0.42) + (boundary_center_x * 0.58)
                next_y = (preferred_y * 0.42) + (boundary_center_y * 0.58)

                reference_index = index_by_id.get(center.map_position_reference_id)
                if reference_index is not None:
                    reference_seed = tuple(seeds[reference_index])
                    next_x = (next_x * 0.48) + (reference_seed[0] * 0.52)
                    next_y = (next_y * 0.48) + (reference_seed[1] * 0.52)
                    next_x, next_y = _constrain_seed_to_reference_direction(
                        (next_x, next_y),
                        reference_seed,
                        requested_direction,
                        center.map_size,
                        ordered[reference_index].map_size,
                    )

                seeds[index] = list(_clamp_seed_to_boundary((next_x, next_y), boundary))
                weights[index] = max(
                    -CENTER_MAP_POWER_WEIGHT_LIMIT,
                    min(CENTER_MAP_POWER_WEIGHT_LIMIT, weights[index] * 0.82),
                )

            final_cells = [
                _compute_power_cell(boundary, index, seeds, weights)
                for index in range(len(ordered))
            ]

        for index, center in enumerate(ordered):
            seed_x, seed_y = _clamp_seed_to_boundary(tuple(seeds[index]), boundary)
            seeds[index] = [seed_x, seed_y]
            final_direction = infer_direction(center, seeds[index])
            final_cell = final_cells[index]
            if len(final_cell) < 3:
                if len(ordered) == 1:
                    final_cell = list(boundary)
                else:
                    final_cell = generate_center_map_shape(
                        size=center.map_size,
                        center_x=seed_x,
                        center_y=seed_y,
                        direction=final_direction,
                        attached_to=center.map_position_reference_id,
                        seed=stable_seed(center),
                        template=_center_map_template(center.map_size, final_direction),
                    )["points"]
                    final_cell = [(point["x"], point["y"]) for point in final_cell]

            center.map_position = {
                "x": seed_x,
                "y": seed_y,
                "direction": final_direction,
                "reference_center_id": center.map_position_reference_id,
            }
            center.map_shape = _shape_from_cell(
                final_cell,
                direction=final_direction,
                attached_to=center.map_position_reference_id,
                seed=stable_seed(center),
            )

        if persist:
            update_fields = ["slug", "map_size", "map_position", "map_shape"]
            with transaction.atomic():
                cls.all_objects.bulk_update(ordered, update_fields)

        return ordered