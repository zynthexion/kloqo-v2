const { format, parse } = require('date-fns');
try {
  const timeStr = format(new Date(), 'hh:mm a');
  console.log("timeStr:", timeStr);
  const parsed = parse(timeStr, 'hh:mm a', new Date());
  console.log("parsed:", parsed);
  console.log("formatted back:", format(parsed, 'HH:mm'));
} catch (e) {
  console.error("error:", e);
}
