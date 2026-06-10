// We also need to make sure the overlay path is hidden or adjusted if necessary?
// The RegionRenderer renders two layers: 'surface' and 'overlay'.
// 'surface' has the background and stroke.
// 'overlay' just has the clip paths, text labels, and point mini cards. It sets `fill="none"` and no `stroke`.
// Wait, RegionRenderer doesn't actually draw anything for `overlay` besides labels and cards.
// Oh actually for 'surface' it uses stroke="rgba(255,255,255,1.0)" and strokeWidth="12"
// I wonder if there is an issue with overlapping labels.
